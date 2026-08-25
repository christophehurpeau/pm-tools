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
    it("keeps the exact ranges a package declares for its own family", () => {
        const ranges = rangesFor(wildcardScenario, wildcardPackages, readWildcardManifest);
        for (const name of wildcardPackages) {
            strictEqual(rangeOf(ranges, name, "metro@0.84.5"), "0.84.5");
            strictEqual(rangeOf(ranges, name, "metro@0.87.0"), "0.87.0");
        }
    });
});
//# sourceMappingURL=collectDependentRanges.test.js.map