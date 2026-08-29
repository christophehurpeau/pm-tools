import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { identifyResolutionFixes } from "pm-utils";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./helpers/buildPackagesMap.js";
import { collectDependents, } from "./helpers/collectDependents.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const loadResolutionsFixture = (fileName) => {
    return JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../test/fixtures/resolutions/${fileName}`, import.meta.url)), 
    // eslint-disable-next-line unicorn/prefer-json-parse-buffer
    "utf8"));
};
const loadDependentsFixture = (fileName) => {
    return JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../test/fixtures/dependents/${fileName}`, import.meta.url)), 
    // eslint-disable-next-line unicorn/prefer-json-parse-buffer
    "utf8"));
};
const objetToMap = (obj) => new Map(Object.entries(obj));
describe("identifyResolutionFixes", () => {
    it("should return an empty array when there are no resolutions", () => {
        const resolutions = [];
        const fixes = identifyResolutionFixes(resolutions, objetToMap({}));
        expect(fixes).toEqual([]);
    });
    it("should return an empty array when there is only one resolution", () => {
        const resolutions = loadResolutionsFixture("semver-7.7.3.json");
        const dependents = loadDependentsFixture("semver-7.7.3.json");
        const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
        expect(fixes).toEqual([]);
    });
    it("should not identify fixes when dependencies are not compatible", () => {
        const resolutions = loadResolutionsFixture("babel-code-frame-7.26.2-7.27.1.json");
        const dependents = loadDependentsFixture("babel-code-frame-7.26.2-7.27.1.json");
        const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
        expect(fixes).toEqual([]);
    });
    it("should identify resolution fixes when dependencies are compatible", () => {
        const resolutions = loadResolutionsFixture("printable-shell-command-5.0.7-5.0.8.json");
        const dependents = loadDependentsFixture("printable-shell-command-5.0.7-5.0.8.json");
        const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
        expect(fixes).toEqual([
            {
                mergeableResolutions: [
                    "printable-shell-command@5.0.7",
                    "printable-shell-command@5.0.8",
                ],
                to: "printable-shell-command@5.0.8",
            },
        ]);
    });
    // `exact-pin-forces-downgrade`: `@yudiel/react-qr-scanner` pins
    // barcode-detector at exactly 3.0.3, `expo-camera` declares `^3.0.0` and got
    // 3.2.2. Only 3.0.3 satisfies both, and it is installed — so bun collapses
    // the copies onto it by rewriting the lockfile, no install round-trip.
    it("merges a caret dependent down onto the version an exact pin forces", () => {
        const bunLock = readAndParseBunLock(fileURLToPath(new URL("../test/fixtures/exact-pin-forces-downgrade/bun.lock", import.meta.url)));
        const packages = parseBunLockPackages(bunLock);
        const duplicates = filterDuplicatesPackagesMap(buildPackagesMap(packages));
        const dependents = collectDependents(packages, bunLock.workspaces, Object.keys(duplicates));
        expect(identifyResolutionFixes(duplicates["barcode-detector"], dependents)).toEqual([
            {
                mergeableResolutions: [
                    "barcode-detector@3.0.3",
                    "barcode-detector@3.2.2",
                ],
                to: "barcode-detector@3.0.3",
            },
        ]);
        // the duplicate that convergence drags along: `^2.1.2` against an exact
        // 3.1.3, which nothing covers
        expect(identifyResolutionFixes(duplicates["zxing-wasm"], dependents)).toEqual([]);
    });
    // `aliased-range-constrains-merge`: the root declares
    // `"psc-pinned": "npm:printable-shell-command@~5.0.0"`, so its constraint only
    // counts once the alias is stripped down to `~5.0.0`. Reading the raw
    // `npm:…` value as a range makes semver answer "not satisfied" for every
    // candidate, which hides 5.0.8 — the one version covering all three
    // dependents — and merges 5.0.7 up onto 5.3.1 instead, breaking `~5.0.0`.
    it("honours the range an aliased dependent declares", () => {
        const bunLock = readAndParseBunLock(fileURLToPath(new URL("../test/fixtures/aliased-range-constrains-merge/bun.lock", import.meta.url)));
        const packages = parseBunLockPackages(bunLock);
        const duplicates = filterDuplicatesPackagesMap(buildPackagesMap(packages));
        const dependents = collectDependents(packages, bunLock.workspaces, Object.keys(duplicates));
        expect(identifyResolutionFixes(duplicates["printable-shell-command"], dependents)).toEqual([
            {
                mergeableResolutions: [
                    "printable-shell-command@5.0.7",
                    "printable-shell-command@5.0.8",
                    "printable-shell-command@5.3.1",
                ],
                to: "printable-shell-command@5.0.8",
            },
        ]);
    });
    // `aliased-swapped-names`: the root pins the real `typescript` at 7.0.2 through
    // the `@typescript/native` key while `tool` needs `^5.9.0`. No candidate covers
    // both, so the pin stays put — reading it as unsatisfiable instead would leave
    // it vouching for nothing and let 7.0.2 be merged up onto 5.9.3.
    it("leaves an exact pin declared under an alias key alone", () => {
        const bunLock = readAndParseBunLock(fixturesBase("../test/fixtures/aliased-swapped-names/bun.lock"));
        const packages = parseBunLockPackages(bunLock);
        const duplicates = filterDuplicatesPackagesMap(buildPackagesMap(packages));
        const dependents = collectDependents(packages, bunLock.workspaces, Object.keys(duplicates));
        expect(Object.keys(duplicates)).toEqual(["typescript"]);
        expect(identifyResolutionFixes(duplicates.typescript, dependents)).toEqual([]);
    });
    // Same shape, with a root range wide enough to merge on: the fix has to name
    // the two real `typescript` resolutions and never the `@typescript/typescript6`
    // sitting under the `typescript` key.
    it("merges the copies an alias key reaches without touching its namesake", () => {
        const bunLock = readAndParseBunLock(fixturesBase("../test/fixtures/aliased-swapped-names-mergeable/bun.lock"));
        const packages = parseBunLockPackages(bunLock);
        const duplicates = filterDuplicatesPackagesMap(buildPackagesMap(packages));
        const dependents = collectDependents(packages, bunLock.workspaces, Object.keys(duplicates));
        expect(identifyResolutionFixes(duplicates.typescript, dependents)).toEqual([
            {
                mergeableResolutions: ["typescript@7.0.2", "typescript@7.1.0"],
                to: "typescript@7.1.0",
            },
        ]);
    });
    it("should not identify any fix for the typescript-eslint duplicates", () => {
        const bunLock = readAndParseBunLock(fileURLToPath(new URL("../test/fixtures/duplicated-typescript-eslint/bun.lock", import.meta.url)));
        const packages = parseBunLockPackages(bunLock);
        const duplicates = filterDuplicatesPackagesMap(buildPackagesMap(packages));
        const dependents = collectDependents(packages, bunLock.workspaces, Object.keys(duplicates));
        const fixesByPackage = Object.fromEntries(Object.entries(duplicates).map(([packageName, resolutions]) => [
            packageName,
            identifyResolutionFixes(resolutions, dependents),
        ]));
        const fixablePackages = Object.entries(fixesByPackage)
            .filter(([, fixes]) => fixes.length > 0)
            .map(([packageName]) => packageName);
        expect(Object.keys(duplicates)).toHaveLength(16);
        expect(fixablePackages).toEqual([]);
    });
});
//# sourceMappingURL=identifyResolutionFixes.test.js.map