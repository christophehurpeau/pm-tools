import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPnpmPackagesMap } from "./helpers/buildPnpmPackagesMap.js";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
import { createManifestReader } from "./helpers/readInstalledManifest.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readPnpmLock } from "./readPnpmLock.js";
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
// The fixtures are committed without node_modules, so the declared ranges of
// the requesters that matter are stubbed; the others fall back to their
// resolved version, as an uninstalled project would.
const manifests = {
    "@tamagui/metro-plugin@1.139.4": {
        "metro-config": "*",
        "metro-transform-worker": "*",
    },
    "@react-native/community-cli-plugin@0.87.0": { metro: "^0.87.0" },
    "@react-native/metro-config@0.87.0": { "metro-config": "^0.87.0" },
    "react-native-web@0.21.2": { "@react-native/normalize-colors": "^0.74.1" },
    "react-native-reanimated@4.5.3": { "react-native": "0.83 - 0.86" },
    "react-native-worklets@0.11.4": {
        "react-native": "0.83 - 0.86",
        "@react-native/metro-config": "*",
    },
    "@pob/eslint-config@65.5.0": {
        "@typescript-eslint/eslint-plugin": "^8.59.1",
        "@typescript-eslint/parser": "^8.59.1",
        "typescript-eslint": "^8.59.1",
    },
    "@pob/eslint-plugin@65.5.0": { "@typescript-eslint/utils": "8.59.1" },
    "eslint-plugin-import-x@4.16.2": {
        "@typescript-eslint/types": "^8.56.0",
        "@typescript-eslint/utils": "^8.56.0",
    },
};
// The @tamagui/* and react-native-* packages peer-depend on react-native with
// an open range (`*`, or `0.83 - 0.86` for reanimated/worklets, both above):
// without them react-native's ranges read as exact resolved versions and the
// "nobody asks for this version" guard is never exercised.
const readStubbedManifest = (name, version) => {
    const dependencies = manifests[`${name}@${version}`];
    if (dependencies)
        return { dependencies };
    if (name.startsWith("@tamagui/") || name.startsWith("react-native-")) {
        return { peerDependencies: { "react-native": "*" } };
    }
    return undefined;
};
const clusterFixesFor = (scenario, readManifest = readStubbedManifest) => {
    const lock = readPnpmLock(fixturesBase(`../test/fixtures/${scenario}/pnpm-lock.yaml`));
    return identifyClusterFixes(lock, buildPnpmPackagesMap(parsePnpmLockPackages(lock)), readManifest);
};
// Only the families: a duplicate with no lockstep sibling is reported as a
// cluster of one, which the tests below single out on its own.
const lockstepFixesFor = (scenario, readManifest = readStubbedManifest) => clusterFixesFor(scenario, readManifest).filter((fix) => fix.members.length > 1);
const metroCluster = () => {
    const fix = clusterFixesFor("wildcard-not-reused").find((candidate) => candidate.members.includes("metro"));
    ok(fix, "expected a cluster containing metro");
    return fix;
};
describe("identifyClusterFixes", () => {
    // Same expectations as bun-dedup's identifyClusterFixes on its own
    // `duplicated-typescript-eslint` fixture: the pnpm adapter must reach the
    // same conclusion from a lockfile shaped very differently.
    it("identifies the @typescript-eslint cluster dedupable to 8.59.1", () => {
        const fixes = lockstepFixesFor("duplicated-typescript-eslint");
        strictEqual(fixes.length, 1);
        const fix = fixes[0];
        strictEqual(fix.applicable, true);
        strictEqual(fix.target, "8.59.1");
        strictEqual(fix.direction, "down");
        strictEqual(fix.needsRoundTrip, true);
        ok(fix.members.includes("typescript-eslint"));
        deepStrictEqual(fix.duplicatedMembers, [
            "@typescript-eslint/project-service",
            "@typescript-eslint/scope-manager",
            "@typescript-eslint/tsconfig-utils",
            "@typescript-eslint/types",
            "@typescript-eslint/typescript-estree",
            "@typescript-eslint/utils",
            "@typescript-eslint/visitor-keys",
        ]);
        deepStrictEqual(fix.reResolutionSet, [
            "@typescript-eslint/eslint-plugin",
            "@typescript-eslint/parser",
            "typescript-eslint",
        ]);
    });
    it("finds no target when the requesters' manifests are unavailable", () => {
        // Without node_modules every transitive range degrades to the resolved
        // version, so `@pob/eslint-config`'s `^8.59.1` reads as `8.61.0` and
        // `@pob/eslint-plugin`'s pin keeps utils at 8.59.1: no version is left that
        // any duplicate can collapse onto.
        const fixes = lockstepFixesFor("duplicated-typescript-eslint", () => undefined);
        strictEqual(fixes.length, 1);
        const fix = fixes[0];
        strictEqual(fix.applicable, false);
        strictEqual(fix.target, null);
        deepStrictEqual(fix.reuseFixes, []);
    });
    // `hoisted-node-linker` is the shape of a real repo that reported no fix at
    // all: with `nodeLinker: hoisted` there is no `node_modules/.pnpm/<pkg>` to
    // read, so every declared range degraded to the resolved version. It is the
    // only fixture whose manifests are committed, so the real reader runs here.
    const hoistedFixtureDir = fixturesBase("../test/fixtures/hoisted-node-linker");
    const hoistedClusterFix = (readManifest) => {
        const lock = readPnpmLock(join(hoistedFixtureDir, "pnpm-lock.yaml"));
        const fixes = identifyClusterFixes(lock, buildPnpmPackagesMap(parsePnpmLockPackages(lock)), readManifest);
        strictEqual(fixes.length, 1);
        return fixes[0];
    };
    it("reads the ranges out of a hoisted node_modules", () => {
        const fix = hoistedClusterFix(createManifestReader(hoistedFixtureDir));
        // the pinned 0.84.5 wins: `mini-plugin` asks for `*`, so nothing external
        // wants 0.87.0 and the pin needs no editing
        strictEqual(fix.applicable, true);
        strictEqual(fix.target, "0.84.5");
        strictEqual(fix.direction, "down");
        deepStrictEqual(fix.convergentMembers, ["mini-metro", "mini-metro-config"]);
        deepStrictEqual(fix.driverMembers, ["mini-metro"]);
        deepStrictEqual(fix.workspaceChanges, []);
        strictEqual(fix.needsRoundTrip, false);
        deepStrictEqual(fix.reuseFixes.map((reuse) => `${reuse.requesterName}>${reuse.packageName} ${reuse.from} -> ${reuse.to}`), [
            // read from a nested manifest three levels deep, via `.modules.yaml`
            "mini-deep>mini-metro-config 0.87.0 -> 0.84.5",
            "mini-plugin>mini-metro-config 0.87.0 -> 0.84.5",
        ]);
    });
    it("inverts the advice when the layout hides the manifests", () => {
        // What the same lockfile reports when the manifests cannot be read:
        // `mini-plugin`'s `*` reads as an exact `0.87.0`, so keeping the pin
        // collapses nothing and the fix becomes "upgrade the pin" — the opposite of
        // the answer above. Hence the warning when nothing is readable.
        const fix = hoistedClusterFix(() => undefined);
        strictEqual(fix.target, "0.87.0");
        strictEqual(fix.direction, "up");
        deepStrictEqual(fix.workspaceChanges.map((change) => `${change.packageName} ${change.range} -> ${change.to}`), ["mini-metro 0.84.5 -> 0.87.0"]);
        deepStrictEqual(fix.reuseFixes, []);
    });
    it("returns no cluster fix when there is no lockstep family", () => {
        deepStrictEqual(lockstepFixesFor("duplicated-printable-shell-command"), []);
    });
    // `exact-pin-forces-downgrade` commits its virtual store, so the real reader
    // runs: `@yudiel/react-qr-scanner` pins barcode-detector at exactly 3.0.3
    // while `expo-camera` declares `^3.0.0` and resolved 3.2.2.
    const downgradeFixtureDir = fixturesBase("../test/fixtures/exact-pin-forces-downgrade");
    it("converges a lone duplicate on the version every range accepts", () => {
        const fixes = clusterFixesFor("exact-pin-forces-downgrade", createManifestReader(downgradeFixtureDir));
        const fix = fixes.find((candidate) => candidate.members.includes("barcode-detector"));
        ok(fix, "expected a fix for barcode-detector");
        deepStrictEqual(fix.members, ["barcode-detector"]);
        strictEqual(fix.applicable, true);
        // 3.2.2 is rejected by the exact pin, so converging means moving the caret
        // dependent down — which only an override can do
        strictEqual(fix.target, "3.0.3");
        strictEqual(fix.direction, "down");
        deepStrictEqual(fix.convergentMembers, ["barcode-detector"]);
        deepStrictEqual(fix.driverMembers, ["barcode-detector"]);
        deepStrictEqual(fix.workspaceChanges, []);
        deepStrictEqual(fix.externalConstraints.map((constraint) => [
            constraint.requesterName,
            constraint.range,
        ]), [
            ["@yudiel/react-qr-scanner", "3.0.3"],
            ["expo-camera", "^3.0.0"],
        ]);
    });
    it("finds nothing for the duplicate a convergence drags along", () => {
        const fixes = clusterFixesFor("exact-pin-forces-downgrade", createManifestReader(downgradeFixtureDir));
        const fix = fixes.find((candidate) => candidate.members.includes("zxing-wasm"));
        ok(fix, "expected a fix record for zxing-wasm");
        // barcode-detector@3.0.3 asks `^2.1.2` and 3.2.2 asks exactly 3.1.3
        strictEqual(fix.applicable, false);
        strictEqual(fix.target, null);
    });
    it("leaves a lone duplicate alone when only a workspace pin could move", () => {
        // `printable-shell-command` is pinned at 5.0.7 by the workspace and at
        // 5.3.1 by `betterdisplaycli`: converging means bumping the user's own pin,
        // which is an upgrade decision rather than a dedupe.
        deepStrictEqual(clusterFixesFor("duplicated-printable-shell-command"), []);
    });
    it("skips clusters whose members are all single-version", () => {
        for (const fix of lockstepFixesFor("wildcard-not-reused")) {
            ok(fix.duplicatedMembers.length > 0);
        }
    });
    it("detects the metro family the non-reused wildcard duplicated", () => {
        const fix = metroCluster();
        for (const member of [
            "metro",
            "metro-config",
            "metro-transform-worker",
            "ob1",
        ]) {
            ok(fix.duplicatedMembers.includes(member), `expected ${member}`);
        }
        strictEqual(fix.duplicatedMembers.length, 16);
    });
    it("keeps external constraints and drops the derived internal pins", () => {
        const byRequester = metroCluster().externalConstraints.map((constraint) => `${constraint.requesterName ?? "workspace"} -> ${constraint.packageName} @ ${constraint.range}`);
        for (const expected of [
            "workspace -> metro @ 0.84.5",
            "@tamagui/metro-plugin -> metro-config @ *",
            "@tamagui/metro-plugin -> metro-transform-worker @ *",
            "react-native-web -> @react-native/normalize-colors @ ^0.74.1",
        ]) {
            ok(byRequester.includes(expected), `expected constraint ${expected}`);
        }
        // metro's own `metro-config: 0.84.5` / `0.87.0` pins are internal: they
        // exist only because metro resolved where it did.
        const requesterNames = new Set(metroCluster().externalConstraints.map((constraint) => constraint.requesterName));
        strictEqual(requesterNames.has("metro"), false);
        strictEqual(requesterNames.has("metro-config"), false);
    });
    it("converges the family on the pinned version, without touching the pin", () => {
        const fix = metroCluster();
        // The root pins metro at 0.84.5 on purpose, so the pin is a constraint to
        // resolve around, not something to upgrade: the family collapses onto
        // 0.84.5 and `workspaceChanges` stays empty.
        strictEqual(fix.applicable, true);
        strictEqual(fix.target, "0.84.5");
        strictEqual(fix.direction, "down");
        strictEqual(fix.convergentMembers.length, 15);
        deepStrictEqual(fix.workspaceChanges, []);
        // metro is the only member a real range applies to (the pin): the 14
        // metro-* packages are requested through `*` or through metro's own exact
        // pins, so they carry no decision and follow it.
        deepStrictEqual(fix.driverMembers, ["metro"]);
    });
    it("leaves react-native's version to the resolver", () => {
        const fix = metroCluster();
        // react-native@0.87.0 and @react-native/metro-config@0.87.0 are what hold
        // the 0.87.0 metro subtree, and nothing pins either of them there — both
        // arrive through `*` / `0.83 - 0.86` peer ranges (0.87.0 does not even
        // satisfy the latter). They have to move, but which version they land on is
        // the resolver's call, so no version is asserted for them.
        deepStrictEqual(fix.floatingMembers, [
            "@react-native/metro-config",
            "react-native",
        ]);
        deepStrictEqual(fix.reResolutionSet, []);
        strictEqual(fix.needsRoundTrip, true);
    });
    it("repoints the wildcards that ignored the pinned version", () => {
        const fix = metroCluster();
        // What the fixture is actually about: `@tamagui/metro-plugin` declares
        // `metro-config: "*"` / `metro-transform-worker: "*"`, and pnpm resolved
        // both to 0.87.0 although the pinned 0.84.5 was already in the tree and the
        // range accepts it — so the plugin runs against a different metro than the
        // app's.
        strictEqual(fix.anchor, "0.84.5");
        deepStrictEqual(fix.reuseFixes.map((reuse) => `${reuse.requesterName}>${reuse.packageName} "${reuse.range}" ${reuse.from} -> ${reuse.to}`), [
            '@tamagui/metro-plugin>metro-config "*" 0.87.0 -> 0.84.5',
            '@tamagui/metro-plugin>metro-transform-worker "*" 0.87.0 -> 0.84.5',
        ]);
    });
    it("leaves alone the ranges that cannot accept the pinned version", () => {
        const repointed = new Set(metroCluster().reuseFixes.map((reuse) => reuse.packageName));
        // `@react-native/metro-config` requires `metro-config: ^0.87.0`, and
        // `react-native-web` requires `@react-native/normalize-colors: ^0.74.1`:
        // neither accepts 0.84.5, so neither is repointed.
        strictEqual(repointed.has("@react-native/normalize-colors"), false);
        deepStrictEqual(metroCluster()
            .reuseFixes.filter((reuse) => reuse.requesterName === "@react-native/metro-config")
            .map((reuse) => reuse.packageName), []);
    });
    // `aliased-swapped-names`: the importer pins the real `typescript` at 7.0.2
    // through the `@typescript/native` key while `tool` needs 5.9.3, and the
    // `typescript` key holds an unrelated package. Nothing converges, and nothing
    // may propose editing the declaration that names the other package.
    it("leaves an exact pin declared under a swapped alias key alone", () => {
        const fixes = clusterFixesFor("aliased-swapped-names", () => undefined);
        deepStrictEqual(fixes.map((fix) => fix.members), [["typescript"]]);
        strictEqual(fixes[0].applicable, false);
        deepStrictEqual(fixes[0].workspaceChanges, []);
    });
    // The same swapped keys, with `typescript` sitting in a lockstep family (its
    // platform binaries) as it does from 7.0.0 on: the family makes the cluster
    // big enough to escape the singleton guard above, and the pin is then the only
    // thing standing between the dedupe and a rewrite of `"@typescript/native":
    // "npm:typescript@7.0.2"` into `npm:typescript@6.0.3` — the alias repointed at
    // the very package it exists to sit beside.
    it("never repoints an alias to converge its family", () => {
        const fix = clusterFixesFor("aliased-swapped-names-cluster", (name, version) => name === "@typescript/typescript6" && version === "6.0.2"
            ? { dependencies: { typescript: "^6" } }
            : undefined).find((candidate) => candidate.members.includes("typescript"));
        ok(fix);
        strictEqual(fix.members.length, 3);
        deepStrictEqual(fix.duplicatedMembers, ["typescript"]);
        strictEqual(fix.applicable, false);
        strictEqual(fix.target, null);
        deepStrictEqual(fix.workspaceChanges, []);
    });
    it("reports a cluster no member can leave as not dedupable", () => {
        // metro pins hermes-parser exactly at 0.35.0 and @react-native/* at 0.36.1,
        // and hermes-estree only exists twice because hermes-parser does: nothing
        // can collapse.
        const fix = clusterFixesFor("wildcard-not-reused").find((candidate) => candidate.members.includes("hermes-parser"));
        ok(fix);
        strictEqual(fix.applicable, false);
        strictEqual(fix.target, null);
        deepStrictEqual(fix.convergentMembers, []);
    });
});
//# sourceMappingURL=identifyClusterFixes.test.js.map