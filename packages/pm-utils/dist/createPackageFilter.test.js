import { describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { createPackageFilter, describeSkippedClusterFix, selectClusterFixes, } from "./createPackageFilter.js";
const clusterFix = (members) => ({
    members,
    duplicatedMembers: members,
    memberVersions: {},
    target: null,
    direction: "none",
    convergentMembers: [],
    driverMembers: [],
    excludedMembers: [],
    anchor: null,
    reuseFixes: [],
    floatingMembers: [],
    workspaceChanges: [],
    reResolutionSet: [],
    externalConstraints: [],
    needsRoundTrip: false,
    applicable: true,
});
describe("createPackageFilter", () => {
    it("selects everything when nothing is asked for", () => {
        const filter = createPackageFilter();
        strictEqual(filter.selectsEverything, true);
        strictEqual(filter.selects("lodash"), true);
        strictEqual(filter.selects("@babel/core"), true);
        strictEqual(filter.rejectionReason("lodash"), undefined);
    });
    it("keeps only the included names", () => {
        const filter = createPackageFilter({ include: ["lodash", "@babel/core"] });
        strictEqual(filter.selectsEverything, false);
        strictEqual(filter.selects("lodash"), true);
        strictEqual(filter.selects("@babel/core"), true);
        strictEqual(filter.selects("react"), false);
        strictEqual(filter.rejectionReason("react"), "not selected");
    });
    it("drops the excluded names and keeps the rest", () => {
        const filter = createPackageFilter({ exclude: ["lodash"] });
        strictEqual(filter.selects("react"), true);
        strictEqual(filter.selects("lodash"), false);
        strictEqual(filter.rejectionReason("lodash"), "excluded");
    });
    it("lets an exclusion hold back part of an included scope", () => {
        const filter = createPackageFilter({
            includeScopes: ["@babel"],
            exclude: ["@babel/runtime"],
        });
        strictEqual(filter.selects("@babel/core"), true);
        strictEqual(filter.selects("@babel/runtime"), false);
        strictEqual(filter.rejectionReason("@babel/runtime"), "excluded");
    });
    it("reads a scope with or without its leading @", () => {
        const withAt = createPackageFilter({ includeScopes: ["@babel"] });
        const withoutAt = createPackageFilter({ includeScopes: ["babel"] });
        for (const filter of [withAt, withoutAt]) {
            strictEqual(filter.selects("@babel/core"), true);
            strictEqual(filter.selects("@babel/plugin-transform-runtime"), true);
            strictEqual(filter.selects("babel-jest"), false);
            strictEqual(filter.selects("@babel-other/core"), false);
        }
    });
    it("excludes a whole scope", () => {
        const filter = createPackageFilter({ excludeScopes: ["@types"] });
        strictEqual(filter.selects("@types/node"), false);
        strictEqual(filter.selects("typescript"), true);
    });
    it("matches a name holding glob-adjacent characters literally", () => {
        const filter = createPackageFilter({
            include: ["lodash.merge", "@scope/a-b_c"],
        });
        strictEqual(filter.selects("lodash.merge"), true);
        strictEqual(filter.selects("@scope/a-b_c"), true);
        strictEqual(filter.selects("lodashXmerge"), false);
    });
    it("stops a single star at the scope separator", () => {
        const filter = createPackageFilter({ include: ["@babel/*"] });
        strictEqual(filter.selects("@babel/core"), true);
        strictEqual(filter.selects("babel"), false);
        const everyUnscoped = createPackageFilter({ include: ["*"] });
        strictEqual(everyUnscoped.selects("lodash"), true);
        strictEqual(everyUnscoped.selects("@babel/core"), false);
    });
});
describe("selectClusterFixes", () => {
    it("passes every fix through when the filter selects everything", () => {
        const fixes = [clusterFix(["@babel/core", "@babel/types"])];
        deepStrictEqual(selectClusterFixes(fixes, createPackageFilter()), {
            selected: fixes,
            skipped: [],
        });
    });
    it("keeps a fix whose whole family is selected", () => {
        const fix = clusterFix(["@babel/core", "@babel/types"]);
        const { selected, skipped } = selectClusterFixes([fix], createPackageFilter({ includeScopes: ["@babel"] }));
        deepStrictEqual(selected, [fix]);
        deepStrictEqual(skipped, []);
    });
    it("skips a partly selected family and names what blocked it", () => {
        const fix = clusterFix(["@babel/core", "@babel/types"]);
        const { selected, skipped } = selectClusterFixes([fix], createPackageFilter({ include: ["@babel/types"] }));
        deepStrictEqual(selected, []);
        deepStrictEqual(skipped, [{ fix, blockedBy: ["@babel/core"] }]);
    });
});
describe("describeSkippedClusterFix", () => {
    it("names the family and counts the blockers past the first few", () => {
        const members = ["a", "b", "c", "d", "e"];
        strictEqual(describeSkippedClusterFix({
            fix: clusterFix(members),
            blockedBy: members,
        }), "cluster a (+4 more): a, b, c (+2 more) not selected by the filter, and a family only converges as a whole");
    });
});
//# sourceMappingURL=createPackageFilter.test.js.map