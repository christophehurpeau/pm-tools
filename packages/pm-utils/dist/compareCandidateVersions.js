import semver from "semver";
/**
 * A version satisfying every dependent holds the maximal count, so it always
 * sorts first: "the highest version that satisfies everyone" falls out of this
 * ordering instead of needing a pass of its own.
 */
export const createCandidateVersionComparator = ({ satisfiedCountOf } = {}) => (versionA, versionB) => {
    if (satisfiedCountOf) {
        const satisfiesA = satisfiedCountOf(versionA);
        const satisfiesB = satisfiedCountOf(versionB);
        if (satisfiesB > satisfiesA)
            return 1;
        if (satisfiesB < satisfiesA)
            return -1;
    }
    return semver.rcompare(versionA, versionB);
};
//# sourceMappingURL=compareCandidateVersions.js.map