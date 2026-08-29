import { describe, expect, it } from "bun:test";
import { loadFixture } from "./helpers/fixtures.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
const fixesFor = (fixture) => {
    const { packages, packagesMap, workspaces } = loadFixture(fixture);
    return identifyClusterFixes(packagesMap, packages, workspaces);
};
describe("identifyClusterFixes", () => {
    // the case the lockfile pass cannot reach: no member can be merged on its
    // own, and the family only converges once every member moves together
    describe("a lockstep family held apart by an exact pin", () => {
        const fix = () => {
            const fixes = fixesFor("duplicated-typescript-eslint");
            expect(fixes).toHaveLength(1);
            return fixes[0];
        };
        it("finds the whole @typescript-eslint family", () => {
            expect(fix().members).toEqual([
                "@typescript-eslint/eslint-plugin",
                "@typescript-eslint/parser",
                "@typescript-eslint/type-utils",
                "@typescript-eslint/types",
                "@typescript-eslint/utils",
            ]);
            expect(fix().duplicatedMembers).toEqual([
                "@typescript-eslint/types",
                "@typescript-eslint/utils",
            ]);
        });
        it("converges it onto the pinned version, downwards", () => {
            expect(fix().applicable).toBe(true);
            expect(fix().target).toBe("8.43.0");
            expect(fix().direction).toBe("down");
            expect(fix().convergentMembers).toEqual([
                "@typescript-eslint/types",
                "@typescript-eslint/utils",
            ]);
            expect(fix().excludedMembers).toEqual([]);
        });
        // `@pob/eslint-plugin`'s exact `8.43.0` on utils is the only external range
        // that is not open: everything else in the family follows it
        it("names the exact pin as the driver", () => {
            expect(fix().driverMembers).toEqual(["@typescript-eslint/utils"]);
            expect(fix().floatingMembers).toEqual([]);
            expect(fix().reuseFixes).toEqual([]);
        });
        // the members pulled in from outside carry no 8.43.0 copy, so reaching it
        // needs a real install
        it("asks for an install round trip for the externally-pulled members", () => {
            expect(fix().reResolutionSet).toEqual([
                "@typescript-eslint/eslint-plugin",
                "@typescript-eslint/parser",
            ]);
            expect(fix().needsRoundTrip).toBe(true);
        });
        it("keeps the real external ranges and drops derived internal pins", () => {
            const constraints = fix().externalConstraints.map((constraint) => `${constraint.requesterName ?? "workspace"} -> ${constraint.packageName} @ ${constraint.range}`);
            expect(constraints).toContain("@pob/eslint-config -> @typescript-eslint/eslint-plugin @ ^8.43.0");
            expect(constraints).toContain("@pob/eslint-plugin -> @typescript-eslint/utils @ 8.43.0");
            const requesters = new Set(fix().externalConstraints.map((c) => c.requesterName));
            expect(requesters.has("@typescript-eslint/type-utils")).toBe(false);
        });
    });
    // the same scenario as bun-dedup's and pnpm-dedup's `wildcard-not-reused`
    // fixture, in yarn's lockfile shape
    it("repoints an open range that ignored the pinned version", () => {
        const fixes = fixesFor("wildcard-not-reused");
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
                requester: "mini-plugin@npm:1.0.0",
                requesterName: "mini-plugin",
                packageName: "mini-metro-config",
                range: "*",
                from: "0.87.0",
                to: "0.84.5",
            },
        ]);
    });
    it("returns no cluster fix when there is no lockstep family", () => {
        expect(fixesFor("duplicated-printable-shell-command")).toEqual([]);
    });
    // barcode-detector pins zxing-wasm at a version of its own, which is not a
    // co-version edge: they are not a family, and the lockfile pass handles them
    it("does not cluster a package that merely pins another", () => {
        expect(fixesFor("exact-pin-forces-downgrade")).toEqual([]);
    });
    it("returns nothing for a lockfile with no duplicate", () => {
        expect(fixesFor("simple")).toEqual([]);
    });
});
//# sourceMappingURL=identifyClusterFixes.test.js.map