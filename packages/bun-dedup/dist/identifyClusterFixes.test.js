import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { buildPackagesMap } from "./helpers/buildPackagesMap.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
const loadFixtureClusterFixes = (relativeLockPath) => {
    const bunLock = readAndParseBunLock(fileURLToPath(new URL(relativeLockPath, import.meta.url)));
    const packages = parseBunLockPackages(bunLock);
    const packagesMap = buildPackagesMap(packages);
    return identifyClusterFixes(packagesMap, packages, bunLock.workspaces);
};
describe("identifyClusterFixes", () => {
    const typescriptEslintFixes = () => loadFixtureClusterFixes("../test/fixtures/duplicated-typescript-eslint/bun.lock");
    it("identifies the @typescript-eslint cluster dedupable to 8.59.1", () => {
        const fixes = typescriptEslintFixes();
        expect(fixes).toHaveLength(1);
        const fix = fixes[0];
        expect(fix.applicable).toBe(true);
        expect(fix.target).toBe("8.59.1");
        expect(fix.direction).toBe("down");
        expect(fix.needsRoundTrip).toBe(true);
        expect(fix.members).toContain("typescript-eslint");
        expect(fix.duplicatedMembers).toEqual([
            "@typescript-eslint/project-service",
            "@typescript-eslint/scope-manager",
            "@typescript-eslint/tsconfig-utils",
            "@typescript-eslint/types",
            "@typescript-eslint/typescript-estree",
            "@typescript-eslint/utils",
            "@typescript-eslint/visitor-keys",
        ]);
    });
    it("targets only the externally-pulled roots whose target is absent", () => {
        const fix = typescriptEslintFixes()[0];
        expect(fix.reResolutionSet).toEqual([
            "@typescript-eslint/eslint-plugin",
            "@typescript-eslint/parser",
            "typescript-eslint",
        ]);
    });
    it("keeps real external constraints and drops derived internal pins", () => {
        const fix = typescriptEslintFixes()[0];
        const byPackageAndRequester = fix.externalConstraints.map((constraint) => `${constraint.requesterName ?? "workspace"} -> ${constraint.packageName} @ ${constraint.range}`);
        for (const expected of [
            "@pob/eslint-config -> @typescript-eslint/eslint-plugin @ ^8.59.1",
            "@pob/eslint-config -> @typescript-eslint/parser @ ^8.59.1",
            "@pob/eslint-config -> typescript-eslint @ ^8.59.1",
            "@pob/eslint-plugin -> @typescript-eslint/utils @ 8.59.1",
            "eslint-plugin-import-x -> @typescript-eslint/types @ ^8.56.0",
        ]) {
            expect(byPackageAndRequester).toContain(expected);
        }
        // no derived "8.61.0" exact internal pin survives the partition
        const requesterNames = new Set(fix.externalConstraints.map((constraint) => constraint.requesterName));
        expect(requesterNames.has("@typescript-eslint/eslint-plugin")).toBe(false);
        expect(requesterNames.has("@typescript-eslint/parser")).toBe(false);
        expect(requesterNames.has("typescript-eslint")).toBe(false);
    });
    // The same scenario as pnpm-dedup's `wildcard-not-reused` fixture, in bun's
    // lockfile shape: a pinned `mini-metro`, and a plugin requesting
    // `mini-metro-config: "*"` that resolved to 0.87.0 rather than reusing the
    // pinned 0.84.5 already in the tree.
    it("repoints an open range that ignored the pinned version", () => {
        const fixes = loadFixtureClusterFixes("../test/fixtures/wildcard-not-reused/bun.lock");
        expect(fixes).toHaveLength(1);
        const fix = fixes[0];
        expect(fix.target).toBe("0.84.5");
        expect(fix.direction).toBe("down");
        expect(fix.anchor).toBe("0.84.5");
        expect(fix.convergentMembers).toEqual(["mini-metro", "mini-metro-config"]);
        expect(fix.driverMembers).toEqual(["mini-metro"]);
        expect(fix.workspaceChanges).toEqual([]);
        expect(fix.reuseFixes).toEqual([
            {
                requester: "mini-plugin",
                requesterName: "mini-plugin",
                packageName: "mini-metro-config",
                range: "*",
                from: "0.87.0",
                to: "0.84.5",
            },
        ]);
    });
    it("keeps the typescript-eslint conclusion, and names its driver", () => {
        const fix = typescriptEslintFixes()[0];
        // `@pob/eslint-plugin`'s exact `8.59.1` on utils is the only external range
        // that is not open: everything else in the family follows it
        expect(fix.driverMembers).toEqual(["@typescript-eslint/utils"]);
        expect(fix.floatingMembers).toEqual([]);
        expect(fix.reuseFixes).toEqual([]);
    });
    it("returns no cluster fix when there is no lockstep family", () => {
        const fixes = loadFixtureClusterFixes("../test/fixtures/duplicated-printable-shell-command/bun.lock");
        expect(fixes).toEqual([]);
    });
});
//# sourceMappingURL=identifyClusterFixes.test.js.map