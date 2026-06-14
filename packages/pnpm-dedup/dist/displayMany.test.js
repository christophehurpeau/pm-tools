import { describe, expect, it } from "bun:test";
import { ok } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { displayMany } from "./displayMany.js";
import { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
import { collectPnpmDependents } from "./helpers/collectPnpmDependents.js";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
import { readPnpmLock } from "./readPnpmLock.js";
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const renderDuplicates = (scenario) => {
    const lock = readPnpmLock(fixturesBase(`../test/fixtures/${scenario}/pnpm-lock.yaml`));
    const duplicates = filterDuplicatesPnpmPackagesMap(buildPnpmPackagesMap(parsePnpmLockPackages(lock)));
    const dependents = collectPnpmDependents(lock, Object.keys(duplicates));
    let buffer = "";
    const log = (message = "") => {
        buffer += `${message}\n`;
    };
    displayMany("duplicates", duplicates, dependents, undefined, log);
    return buffer;
};
describe("displayMany", () => {
    it("renders resolutions and dependents for a duplicated package", () => {
        const output = renderDuplicates("duplicated-babel-frame");
        ok(output.startsWith("Found "));
        ok(output.includes("@babel/code-frame:"));
        ok(output.includes("  Resolutions:"));
        ok(output.includes("    - @babel/code-frame@7.26.2"));
        ok(output.includes("  Dependents:"));
        ok(output.includes('package.json in dependencies asking for "7.26.2"'));
        // no fixes section in the list step
        ok(!output.includes("Possible fixes"));
    });
    it("renders the printable-shell-command duplicate", () => {
        const output = renderDuplicates("duplicated-printable-shell-command");
        ok(output.includes("printable-shell-command:"));
        ok(output.includes("    - printable-shell-command@5.0.7"));
    });
    it("reports no duplicates for a clean lockfile", () => {
        expect(renderDuplicates("simple")).toBe("No duplicates found\n");
    });
});
//# sourceMappingURL=displayMany.test.js.map