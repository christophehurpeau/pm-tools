import semver from "semver";
import { createCandidateVersionComparator } from "./compareCandidateVersions.js";
const isNpmResolution = (resolution) => resolution.package.type === "npm";
/**
 * Dedupe opportunities reachable one package at a time. A family of co-versioned
 * packages whose duplicate survives only because a few members resolve high is
 * invisible here and is handled by `identifyLockstepClusterFixes`.
 */
export const identifyResolutionFixes = (resolutions, dependents) => {
    if (resolutions.length <= 1) {
        return [];
    }
    const onlyNpmResolutions = resolutions.filter(isNpmResolution);
    const fixes = [];
    const packageNames = new Set(resolutions.map((resolution) => resolution.package.name));
    for (const packageName of packageNames) {
        const npmVersions = onlyNpmResolutions
            .filter((resolution) => resolution.package.name === packageName)
            .map((resolution) => ({
            resolution,
            version: resolution.package.version,
            satisfies: new Set(),
        }));
        // Every requester can declare the package through something semver cannot
        // read — a git url, `file:`, `workspace:` — and such a declaration is
        // dropped here rather than treated as a range nothing satisfies, which
        // would suppress the merges the real dependents allow. Once they are gone
        // nothing may vouch for a merge at all, and the "one candidate covers every
        // dependent" test below would read the empty set as full coverage.
        const packageDependents = dependents
            .get(packageName)
            ?.filter((dependent) => !dependent.nonSemver);
        if (!packageDependents || packageDependents.length === 0)
            continue;
        packageDependents.forEach((dependent) => {
            for (const { version, satisfies } of npmVersions) {
                if (semver.satisfies(version, dependent.version, {
                    includePrerelease: true,
                })) {
                    satisfies.add(dependent);
                }
            }
        });
        const byVersionAscending = (resolutionA, resolutionB) => {
            const versionA = npmVersions.find((candidate) => candidate.resolution.resolution === resolutionA)?.version;
            const versionB = npmVersions.find((candidate) => candidate.resolution.resolution === resolutionB)?.version;
            return versionA && versionB ? semver.compare(versionA, versionB) : 0;
        };
        const satisfiedCountByVersion = new Map(npmVersions.map(({ version, satisfies }) => [version, satisfies.size]));
        const compareCandidates = createCandidateVersionComparator({
            satisfiedCountOf: (version) => satisfiedCountByVersion.get(version) ?? 0,
        });
        // the best-ranked candidate satisfies everyone whenever any candidate does
        const [bestCandidate] = npmVersions.toSorted((candidateA, candidateB) => compareCandidates(candidateA.version, candidateB.version));
        if (bestCandidate?.satisfies.size === packageDependents.length) {
            const mergeableResolutions = npmVersions
                .map((candidate) => candidate.resolution.resolution)
                .toSorted(byVersionAscending);
            if (mergeableResolutions.length > 1) {
                fixes.push({
                    mergeableResolutions,
                    to: bestCandidate.resolution.resolution,
                });
            }
            continue;
        }
        // no single candidate satisfies all dependents — do greedy assignment from highest -> lowest
        npmVersions.sort((candidateA, candidateB) => semver.rcompare(candidateA.version, candidateB.version));
        const unassigned = new Set(packageDependents);
        for (const candidate of npmVersions) {
            const newlyAssigned = new Set([...candidate.satisfies].filter((dependent) => unassigned.has(dependent)));
            if (newlyAssigned.size === 0)
                continue;
            const mergeable = npmVersions.filter((other) => {
                if (other === candidate)
                    return false;
                const intersects = [...other.satisfies].some((dependent) => newlyAssigned.has(dependent));
                if (!intersects)
                    return false;
                // merging is safe only when the candidate satisfies every dependent the
                // resolution being merged away was serving
                return [...other.satisfies].every((dependent) => candidate.satisfies.has(dependent));
            });
            const mergeableResolutions = [
                candidate.resolution.resolution,
                ...mergeable.map((other) => other.resolution.resolution),
            ].toSorted(byVersionAscending);
            if (mergeableResolutions.length > 1) {
                fixes.push({
                    mergeableResolutions,
                    to: candidate.resolution.resolution,
                });
            }
            for (const dependent of newlyAssigned)
                unassigned.delete(dependent);
            if (unassigned.size === 0)
                break;
        }
    }
    return fixes;
};
//# sourceMappingURL=identifyResolutionFixes.js.map