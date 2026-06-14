import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readPnpmLock } from "../readPnpmLock.js";
import { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./buildPnpmPackagesMap.js";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.js";
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const buildFor = (scenario) => buildPnpmPackagesMap(parsePnpmLockPackages(readPnpmLock(fixturesBase(`../../test/fixtures/${scenario}/pnpm-lock.yaml`))));
const versionsOf = (packagesMap, name) => new Set((packagesMap[name] ?? []).map((resolution) => resolution.package.version));
describe("buildPnpmPackagesMap", () => {
    it("reports no duplicates for the simple fixture", () => {
        const packagesMap = buildFor("simple");
        strictEqual(packagesMap.semver?.length, 1);
        strictEqual(Object.keys(filterDuplicatesPnpmPackagesMap(packagesMap)).length, 0);
    });
    it("reports no duplicates for one-dependency-of-dependency", () => {
        const packagesMap = buildFor("one-dependency-of-dependency");
        strictEqual(Object.keys(filterDuplicatesPnpmPackagesMap(packagesMap)).length, 0);
    });
    it("detects the duplicated @babel/code-frame versions", () => {
        const duplicates = filterDuplicatesPnpmPackagesMap(buildFor("duplicated-babel-frame"));
        const versions = versionsOf(duplicates, "@babel/code-frame");
        strictEqual(versions.size, 2);
        ok(versions.has("7.26.2"));
    });
    it("detects the duplicated printable-shell-command versions", () => {
        const duplicates = filterDuplicatesPnpmPackagesMap(buildFor("duplicated-printable-shell-command"));
        ok(duplicates["printable-shell-command"]);
        strictEqual(duplicates["printable-shell-command"].length, 2);
    });
    it("detects at least the known @typescript-eslint duplicates", () => {
        const duplicates = filterDuplicatesPnpmPackagesMap(buildFor("duplicated-typescript-eslint"));
        // Acceptance floor: the set of detected duplicates must include these.
        const required = [
            "@typescript-eslint/types",
            "@typescript-eslint/scope-manager",
            "@typescript-eslint/utils",
            "@eslint/plugin-kit",
        ];
        for (const name of required) {
            ok(duplicates[name], `expected ${name} to be detected as duplicate`);
            strictEqual(duplicates[name].length, 2);
        }
        const typesVersions = versionsOf(duplicates, "@typescript-eslint/types");
        ok(typesVersions.has("8.59.1"));
        ok(typesVersions.has("8.61.0"));
    });
});
//# sourceMappingURL=buildPnpmPackagesMap.test.js.map