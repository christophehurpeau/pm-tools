import { describe, expect, it } from "bun:test";
import { identifyResolutionFixes } from "./identifyResolutionFixes.js";
const npm = (name, version) => ({
    resolution: `${name}@${version}`,
    package: { type: "npm", name, version },
});
const workspace = (name) => ({
    resolution: `${name}@workspace`,
    package: { type: "workspace", name },
});
const dependentsOf = (name, ranges) => new Map([[name, ranges.map((version) => ({ version }))]]);
describe("identifyResolutionFixes", () => {
    it("ignores a dependent whose declaration semver cannot read", () => {
        // read as a range, `workspace:*` satisfies neither candidate and the merge
        // the real dependent allows would be suppressed
        const dependents = new Map([
            [
                "lib",
                [{ version: "^1.0.0" }, { version: "workspace:*", nonSemver: true }],
            ],
        ]);
        expect(identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0")], dependents)).toEqual([
            { mergeableResolutions: ["lib@1.0.0", "lib@1.2.0"], to: "lib@1.2.0" },
        ]);
    });
    it("vouches for no merge when every dependent is unreadable", () => {
        const dependents = new Map([
            ["lib", [{ version: "workspace:*", nonSemver: true }]],
        ]);
        expect(identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0")], dependents)).toEqual([]);
    });
    it("returns nothing for fewer than two resolutions", () => {
        expect(identifyResolutionFixes([], new Map())).toEqual([]);
        expect(identifyResolutionFixes([npm("lib", "1.0.0")], new Map())).toEqual([]);
    });
    it("merges every resolution onto the highest version satisfying all dependents", () => {
        const fixes = identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0")], dependentsOf("lib", ["^1.0.0", "^1.2.0"]));
        expect(fixes).toEqual([
            { mergeableResolutions: ["lib@1.0.0", "lib@1.2.0"], to: "lib@1.2.0" },
        ]);
    });
    it("partitions greedily when no version satisfies every dependent", () => {
        const fixes = identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0"), npm("lib", "2.0.0")], dependentsOf("lib", ["^1.0.0", "^1.2.0", "^2.0.0"]));
        expect(fixes).toEqual([
            { mergeableResolutions: ["lib@1.0.0", "lib@1.2.0"], to: "lib@1.2.0" },
        ]);
    });
    it("refuses a merge that would drop a dependent the merged resolution served", () => {
        // `>=1.0.0` accepts 2.0.0, but merging 1.2.0 into it would strand `^1.0.0`
        const fixes = identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0"), npm("lib", "2.0.0")], dependentsOf("lib", [">=1.0.0", "^1.0.0", "2.0.0"]));
        expect(fixes).toEqual([
            { mergeableResolutions: ["lib@1.0.0", "lib@1.2.0"], to: "lib@1.2.0" },
        ]);
    });
    it("ignores resolutions that are not npm packages", () => {
        const fixes = identifyResolutionFixes([npm("lib", "1.0.0"), workspace("lib"), npm("lib", "1.2.0")], dependentsOf("lib", ["^1.0.0", "^1.2.0"]));
        expect(fixes).toEqual([
            { mergeableResolutions: ["lib@1.0.0", "lib@1.2.0"], to: "lib@1.2.0" },
        ]);
    });
    // Reachable as soon as every requester declares the package through something
    // semver cannot read: those declarations are left out of the map, and no range
    // is left to vouch for a merge. Reading the empty set as "one candidate covers
    // every dependent" would merge the whole package on no evidence at all.
    it("proposes nothing for a package with no collected dependents", () => {
        expect(identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0")], new Map())).toEqual([]);
        expect(identifyResolutionFixes([npm("lib", "1.0.0"), npm("lib", "1.2.0")], new Map([["lib", []]]))).toEqual([]);
    });
});
//# sourceMappingURL=identifyResolutionFixes.test.js.map