import { describe, expect, it } from "bun:test";
import { filterDuplicatesYarnPackagesMap } from "./buildYarnPackagesMap.js";
import { loadFixture } from "./fixtures.js";
describe("buildYarnPackagesMap", () => {
    it("groups the resolutions of a name and records what asked for each", () => {
        const { packagesMap } = loadFixture("duplicated-printable-shell-command");
        expect(packagesMap["printable-shell-command"]?.map(({ resolution, installations }) => ({ resolution, installations }))).toEqual([
            {
                resolution: "printable-shell-command@npm:5.0.7",
                installations: ["printable-shell-command@npm:^5.0.7"],
            },
            {
                resolution: "printable-shell-command@npm:5.0.8",
                installations: ["printable-shell-command@npm:^5.0.8"],
            },
        ]);
    });
    it("counts one resolution however many descriptors reach it", () => {
        const { packagesMap } = loadFixture("simple");
        expect(packagesMap.lodash).toHaveLength(1);
    });
    it("keeps only the names resolved more than once", () => {
        const { packagesMap } = loadFixture("duplicated-printable-shell-command");
        const duplicates = filterDuplicatesYarnPackagesMap(packagesMap);
        expect(Object.keys(duplicates)).toEqual(["printable-shell-command"]);
    });
    // the patch layer is a second resolution of the same name, and it is one the
    // npm passes must not merge away
    it("reports a patched package alongside the release it patches", () => {
        const { packagesMap } = loadFixture("non-npm");
        expect(packagesMap.resolve?.map((r) => r.package.type)).toEqual([
            "npm",
            "other",
        ]);
    });
});
//# sourceMappingURL=buildYarnPackagesMap.test.js.map