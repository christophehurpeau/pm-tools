import { describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readPnpmLock } from "../readPnpmLock.js";
import { collectDependentRanges } from "./collectDependentRanges.js";
import { createManifestReader } from "./readInstalledManifest.js";
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const lockFor = (scenario) => readPnpmLock(fixturesBase(`../../test/fixtures/${scenario}/pnpm-lock.yaml`));
const rangesFor = (scenario, packageNames, readManifest = () => undefined) => collectDependentRanges(lockFor(scenario), new Set(packageNames), readManifest);
// In `wildcard-not-reused`, `@tamagui/metro-plugin@1.139.4` declares
// `metro-config: "*"` and `metro-transform-worker: "*"`. The lockfile only
// stores the version pnpm picked (0.87.0), so the wildcard is only visible
// through the installed manifest.
const wildcardScenario = "wildcard-not-reused";
const wildcardPackages = ["metro-config", "metro-transform-worker"];
const wildcardDependent = "@tamagui/metro-plugin@1.139.4";
const readWildcardManifest = (name, version) => name === "@tamagui/metro-plugin" && version === "1.139.4"
    ? { dependencies: { "metro-config": "*", "metro-transform-worker": "*" } }
    : undefined;
// `exact-pin-forces-downgrade` commits its virtual store, so the ranges come
// from the real reader: `@yudiel/react-qr-scanner` pins `barcode-detector`
// exactly at 3.0.3 while `expo-camera` declares `^3.0.0` and resolved 3.2.2.
const downgradeScenario = "exact-pin-forces-downgrade";
const readDowngradeManifest = createManifestReader(fixturesBase(`../../test/fixtures/${downgradeScenario}`));
const rangeOf = (ranges, packageName, dependentKey) => ranges.get(packageName)?.find((dependent) => dependent.key === dependentKey)
    ?.range;
describe("collectDependentRanges", () => {
    it("takes a direct dependency's range from the importer specifier", () => {
        deepStrictEqual(rangesFor("simple", ["semver"]).get("semver"), [
            {
                key: "package.json in dependencies",
                range: "7.7.3",
                resolvedVersion: "7.7.3",
                workspace: { path: ".", depType: "dependencies" },
            },
        ]);
    });
    it("ignores packages that are not in the requested set", () => {
        deepStrictEqual([...rangesFor("duplicated-babel-frame", ["@babel/code-frame"]).keys()], ["@babel/code-frame"]);
    });
    it("reads a transitive dependent's declared range from its manifest", () => {
        const ranges = rangesFor(wildcardScenario, wildcardPackages, readWildcardManifest);
        for (const name of wildcardPackages) {
            strictEqual(rangeOf(ranges, name, wildcardDependent), "*");
        }
    });
    it("falls back to the resolved version when the manifest is unavailable", () => {
        const ranges = rangesFor(wildcardScenario, wildcardPackages);
        for (const name of wildcardPackages) {
            strictEqual(rangeOf(ranges, name, wildcardDependent), "0.87.0");
        }
    });
    // pnpm folds a resolved peer into the snapshot's `dependencies`, so the edge is
    // there — but only as the version it resolved to. The range stays in the
    // `packages:` entry, and read from there a peer constraint needs no
    // `node_modules`: without it every one of these read as an exact pin of 10.5.0,
    // and no version could satisfy them all.
    it("reads a peer range from the lockfile when no manifest is available", () => {
        const ranges = rangesFor("duplicated-typescript-eslint", ["eslint"]);
        strictEqual(rangeOf(ranges, "eslint", "@eslint-community/eslint-utils@4.9.1"), "^6.0.0 || ^7.0.0 || >=8.0.0");
        strictEqual(rangeOf(ranges, "eslint", "@typescript-eslint/eslint-plugin@8.61.0"), "^8.57.0 || ^9.0.0 || ^10.0.0");
        // declared optional, and kept: pnpm only writes the edge once something
        // provides the peer, so an edge that exists is a peer that was provided
        strictEqual(rangeOf(ranges, "eslint", "@eslint/js@10.0.1"), "^10.0.0");
    });
    // pnpm resolves a peer like any other edge, so nothing in the snapshot tells a
    // peer requester apart from one holding a copy of its own — the report has to
    it("marks a dependent whose range came from a peer declaration", () => {
        const dependents = rangesFor("duplicated-typescript-eslint", ["eslint"]).get("eslint") ?? [];
        strictEqual(dependents.find((dependent) => dependent.key === "eslint-plugin-n@17.24.0")?.peer, true);
        // a real dependency edge onto the same package stays unmarked
        strictEqual(rangesFor("duplicated-typescript-eslint", ["@eslint/plugin-kit"])
            .get("@eslint/plugin-kit")
            ?.find((dependent) => dependent.key === "eslint@10.5.0")?.peer, undefined);
    });
    // the manifest is read first, so a name a package declares as both a
    // dependency and a peer keeps the dependency's range
    it("prefers a manifest declaration over the lockfile peer block", () => {
        strictEqual(rangeOf(rangesFor("duplicated-typescript-eslint", ["eslint"], (name, version) => name === "@eslint-community/eslint-utils" && version === "4.9.1"
            ? { dependencies: { eslint: "^10.1.0" } }
            : undefined), "eslint", "@eslint-community/eslint-utils@4.9.1"), "^10.1.0");
    });
    it("separates a caret dependent's range from the version it resolved to", () => {
        const ranges = rangesFor(downgradeScenario, ["barcode-detector"], readDowngradeManifest);
        deepStrictEqual(ranges.get("barcode-detector"), [
            {
                key: "@yudiel/react-qr-scanner@2.3.1",
                range: "3.0.3",
                resolvedVersion: "3.0.3",
                requesterName: "@yudiel/react-qr-scanner",
            },
            {
                key: "expo-camera@57.0.3",
                range: "^3.0.0",
                resolvedVersion: "3.2.2",
                requesterName: "expo-camera",
            },
        ]);
    });
    // `aliased-swapped-names`: the importer reaches the real `typescript` through
    // the `@typescript/native` key and hands the `typescript` key to another
    // package. The dependent has to be filed under the npm name the specifier
    // targets, with the range and the version the alias resolved to, and the key
    // it was declared under — that key is what makes the declaration binding
    // rather than a range the dedupe may rewrite.
    it("resolves an importer alias whose key names another package", () => {
        const ranges = rangesFor("aliased-swapped-names", [
            "typescript",
            "@typescript/typescript6",
        ]);
        deepStrictEqual(ranges.get("typescript"), [
            {
                key: "package.json in devDependencies",
                range: "7.0.2",
                resolvedVersion: "7.0.2",
                aliasKey: "@typescript/native",
                workspace: { path: ".", depType: "devDependencies" },
            },
            {
                key: "tool@1.0.0",
                range: "5.9.3",
                resolvedVersion: "5.9.3",
                requesterName: "tool",
            },
        ]);
        deepStrictEqual(ranges.get("@typescript/typescript6"), [
            {
                key: "package.json in devDependencies",
                range: "6.0.2",
                resolvedVersion: "6.0.2",
                aliasKey: "typescript",
                workspace: { path: ".", depType: "devDependencies" },
            },
        ]);
    });
    // pnpm writes an aliased importer's `version` as `realName@version`, which is
    // not a version: carrying it through would put a string no semver call accepts
    // where the resolved version belongs.
    it("strips the alias target from an importer's resolved version", () => {
        deepStrictEqual(rangesFor("mergeable-alias", ["printable-shell-command"])
            .get("printable-shell-command")
            ?.filter((dependent) => dependent.workspace !== undefined), [
            {
                key: "package.json in devDependencies",
                range: "^5.0.0",
                resolvedVersion: "5.3.1",
                workspace: { path: ".", depType: "devDependencies" },
            },
            {
                key: "package.json in devDependencies",
                range: "5.0.7",
                resolvedVersion: "5.0.7",
                aliasKey: "printable-shell-command-pinned",
                workspace: { path: ".", depType: "devDependencies" },
            },
        ]);
    });
    it("keeps the exact ranges a package declares for its own family", () => {
        const ranges = rangesFor(wildcardScenario, wildcardPackages, readWildcardManifest);
        for (const name of wildcardPackages) {
            strictEqual(rangeOf(ranges, name, "metro@0.84.5"), "0.84.5");
            strictEqual(rangeOf(ranges, name, "metro@0.87.0"), "0.87.0");
        }
    });
    // A `workspace:`, `catalog:`, `file:` or `link:` specifier names something
    // other than the npm package sharing its key, and a dist-tag carries no
    // comparable range. Both would read as unsatisfiable ranges rather than as
    // "no constraint", which suppresses merges the real dependents allow.
    it("leaves out importer specifiers that are not npm ranges", () => {
        const ranges = rangesFor("protocol-dependents", [
            "helper",
            "semver",
            "picocolors",
            "left-pad",
            "kleur",
            "chalk",
        ]);
        // only the snapshot dependent of `app` survives for semver; the importer
        // declares it as `latest`
        deepStrictEqual(ranges.get("semver"), [
            {
                key: "app@1.0.0",
                range: "7.8.1",
                resolvedVersion: "7.8.1",
                requesterName: "app",
            },
        ]);
        for (const name of ["helper", "picocolors", "left-pad", "kleur", "chalk"]) {
            strictEqual(ranges.has(name), false);
        }
    });
    // A transitive dependent whose installed manifest declares a non-npm
    // protocol falls back to the version it actually got, rather than carrying
    // `workspace:*` into a semver comparison.
    it("falls back to the resolved version when the manifest range is not comparable", () => {
        const readWorkspaceManifest = (name, version) => name === "@tamagui/metro-plugin" && version === "1.139.4"
            ? {
                dependencies: {
                    "metro-config": "workspace:*",
                    "metro-transform-worker": "*",
                },
            }
            : undefined;
        const ranges = rangesFor(wildcardScenario, wildcardPackages, readWorkspaceManifest);
        strictEqual(rangeOf(ranges, "metro-config", wildcardDependent), 
        // the resolved version, not `*` and not `workspace:*`
        "0.87.0");
        strictEqual(rangeOf(ranges, "metro-transform-worker", wildcardDependent), "*");
    });
});
//# sourceMappingURL=collectDependentRanges.test.js.map