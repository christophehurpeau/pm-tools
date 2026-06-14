import semver from "semver";
const satisfiesAll = (version, ranges) => ranges.every((range) => semver.satisfies(version, range, { includePrerelease: true }));
/**
 * For each duplicated package, find the highest installed version that
 * satisfies every dependent's declared range. When such a version exists,
 * adding it as a root devDependency lets pnpm collapse the duplicates onto it.
 * When no single version covers all dependents, no safe single-add exists and
 * the package is skipped.
 */
export const identifyDevDependencyFixes = (duplicatesPackagesMap, dependentRanges) => {
    const fixes = new Map();
    for (const [name, resolutions] of Object.entries(duplicatesPackagesMap)) {
        const versions = resolutions
            .filter((resolution) => resolution.package.type === "npm")
            .map((resolution) => resolution.package.version);
        if (versions.length < 2)
            continue;
        const ranges = dependentRanges.get(name);
        if (!ranges || ranges.length === 0)
            continue;
        const rangeValues = ranges.map((dependent) => dependent.range);
        const covering = versions
            .filter((version) => satisfiesAll(version, rangeValues))
            .sort(semver.rcompare);
        const best = covering[0];
        if (best) {
            fixes.set(name, { name, version: best });
        }
    }
    return fixes;
};
//# sourceMappingURL=identifyDevDependencyFixes.js.map