export interface CandidateVersionComparatorOptions {
    satisfiedCountOf?: (version: string) => number;
}
/**
 * A version satisfying every dependent holds the maximal count, so it always
 * sorts first: "the highest version that satisfies everyone" falls out of this
 * ordering instead of needing a pass of its own.
 */
export declare const createCandidateVersionComparator: ({ satisfiedCountOf }?: CandidateVersionComparatorOptions) => (versionA: string, versionB: string) => number;
//# sourceMappingURL=compareCandidateVersions.d.ts.map