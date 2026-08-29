import { describe, expect, it } from "bun:test";
import { createCandidateVersionComparator } from "./compareCandidateVersions.js";
const satisfiedCounts = new Map([
    ["1.0.0", 1],
    ["1.5.0", 3],
    ["2.0.0", 3],
    ["3.0.0", 2],
]);
const satisfiedCountOf = (version) => satisfiedCounts.get(version) ?? 0;
describe("createCandidateVersionComparator", () => {
    it("puts the version satisfying the most dependents first", () => {
        const compare = createCandidateVersionComparator({ satisfiedCountOf });
        expect(["1.0.0", "3.0.0", "1.5.0"].toSorted(compare)).toEqual([
            "1.5.0",
            "3.0.0",
            "1.0.0",
        ]);
    });
    it("breaks a tie on the highest version", () => {
        const compare = createCandidateVersionComparator({ satisfiedCountOf });
        expect(["1.5.0", "2.0.0"].toSorted(compare)).toEqual(["2.0.0", "1.5.0"]);
    });
    it("ranks on semver alone without a satisfied count", () => {
        const compare = createCandidateVersionComparator();
        expect(["1.0.0", "3.0.0", "1.5.0"].toSorted(compare)).toEqual([
            "3.0.0",
            "1.5.0",
            "1.0.0",
        ]);
    });
});
//# sourceMappingURL=compareCandidateVersions.test.js.map