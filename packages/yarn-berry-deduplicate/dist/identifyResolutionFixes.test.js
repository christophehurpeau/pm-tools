import { describe, expect, it } from "bun:test";
import { buildIdentifiedFixesMap } from "pm-utils";
import { filterDuplicatesYarnPackagesMap } from "./helpers/buildYarnPackagesMap.js";
import { collectYarnDependents } from "./helpers/collectYarnDependents.js";
import { loadFixture } from "./helpers/fixtures.js";
const fixesFor = (fixture) => {
    const { packages, packagesMap, workspaces } = loadFixture(fixture);
    const duplicates = filterDuplicatesYarnPackagesMap(packagesMap);
    return buildIdentifiedFixesMap(duplicates, collectYarnDependents({
        packages,
        workspaces,
        onlyPackageNames: Object.keys(duplicates),
    }));
};
const mergesFor = (fixture, packageName) => (fixesFor(fixture).get(packageName) ?? []).filter((fix) => fix.mergeableResolutions.length > 1);
describe("identifyResolutionFixes over yarn lockfiles", () => {
    it("merges a pair one version satisfies", () => {
        expect(mergesFor("duplicated-printable-shell-command", "printable-shell-command")).toEqual([
            {
                mergeableResolutions: [
                    "printable-shell-command@npm:5.0.7",
                    "printable-shell-command@npm:5.0.8",
                ],
                to: "printable-shell-command@npm:5.0.8",
            },
        ]);
    });
    it("merges an aliased range onto the direct one", () => {
        expect(mergesFor("mergeable-alias", "printable-shell-command")).toHaveLength(1);
    });
    it("leaves an aliased range that covers nothing else alone", () => {
        expect(mergesFor("aliased-range-constrains-merge", "printable-shell-command")).toEqual([]);
    });
    it("does not merge incompatible majors", () => {
        expect(mergesFor("duplicated-babel-frame", "@babel/code-frame")).toEqual([]);
    });
    // the exact pin is the only version both requesters accept, so the merge is a
    // downgrade for the one that resolved higher
    it("merges onto an exact pin even when it means going down", () => {
        expect(mergesFor("exact-pin-forces-downgrade", "barcode-detector")).toEqual([
            {
                mergeableResolutions: [
                    "barcode-detector@npm:3.0.3",
                    "barcode-detector@npm:3.2.2",
                ],
                to: "barcode-detector@npm:3.0.3",
            },
        ]);
    });
    // zxing-wasm's two copies are held by ranges that do not overlap; only the
    // barcode-detector merge above can bring them together, and only through a
    // real re-resolution
    it("leaves an unsatisfiable pair alone", () => {
        expect(mergesFor("exact-pin-forces-downgrade", "zxing-wasm")).toEqual([]);
    });
    // the two open ranges holding 1.5.0 and 2.1.0 are both happy with 2.1.0; only
    // uses-peer's peer range `^1.0.0` stands in the way, and missing it turned an
    // out-of-range upgrade into a proposed fix
    it("leaves a pair a peer range forbids merging alone", () => {
        expect(mergesFor("peer-range-constrains-merge", "peer-pkg")).toEqual([]);
    });
    it("never merges a patched resolution into the release it patches", () => {
        expect(mergesFor("non-npm", "resolve")).toEqual([]);
    });
    // the `patch:` declaration is reported so the patched copy has an explanation,
    // but semver cannot read it and it must not weigh on the merge either way
    it("ignores a declaration semver cannot read", () => {
        expect(mergesFor("declared-patch", "lodash")).toEqual([]);
    });
    // the family only moves as a whole; no single package can be merged on its own
    it("finds nothing to merge in a lockstep family", () => {
        expect(mergesFor("duplicated-typescript-eslint", "@typescript-eslint/types")).toEqual([]);
        expect(mergesFor("duplicated-typescript-eslint", "@typescript-eslint/utils")).toEqual([]);
    });
    it("finds nothing in a lockfile with no duplicate", () => {
        expect([...fixesFor("simple").keys()]).toEqual([]);
    });
});
//# sourceMappingURL=identifyResolutionFixes.test.js.map