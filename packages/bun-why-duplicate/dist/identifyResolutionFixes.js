import semver from "semver";
export function identifyResolutionFixes(resolutions, dependents) {
    if (resolutions.length <= 1) {
        return [];
    }
    const onlyNpmResolutions = resolutions
        // only try to merge resolutions that are npm packages
        .filter((resolution) => resolution.package.type === "npm");
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
        const packageDependents = dependents.get(packageName);
        if (!packageDependents) {
            throw new Error(`Unexpected missing dependents for package ${packageName}`);
        }
        packageDependents.forEach((dependent) => {
            for (const { version, satisfies } of npmVersions) {
                if (semver.satisfies(version, dependent.version, {
                    includePrerelease: true,
                })) {
                    satisfies.add(dependent);
                }
            }
        });
        // try to find a single installed version that satisfies ALL dependents
        const allDependentsCount = packageDependents.length;
        const coveringCandidates = npmVersions.filter((c) => c.satisfies.size === allDependentsCount);
        if (coveringCandidates.length > 0) {
            // pick the highest semver among candidates that satisfy everyone
            coveringCandidates.sort((a, b) => semver.rcompare(a.version, b.version));
            const target = coveringCandidates[0];
            const megeableResolutions = npmVersions
                .map((r) => r.resolution.resolution)
                // stable ordering: sort by version ascending
                .toSorted((a, b) => {
                const va = npmVersions.find((n) => n.resolution.resolution === a)?.version;
                const vb = npmVersions.find((n) => n.resolution.resolution === b)?.version;
                return va && vb ? semver.compare(va, vb) : 0;
            });
            if (megeableResolutions.length > 1 && target) {
                fixes.push({
                    megeableResolutions,
                    to: target.resolution.resolution,
                });
            }
            // all dependents are covered by this single target; nothing more to do
            continue;
        }
        // no single candidate satisfies all dependents — do greedy assignment from highest -> lowest
        npmVersions.sort((a, b) => semver.rcompare(a.version, b.version));
        const unassigned = new Set(packageDependents);
        for (const candidate of npmVersions) {
            // dependents this candidate can satisfy that are still unassigned
            const satisfied = new Set([...candidate.satisfies].filter((d) => unassigned.has(d)));
            if (satisfied.size === 0)
                continue;
            // find other installed resolutions that can be safely merged into this candidate
            const mergeable = npmVersions.filter((r) => {
                if (r === candidate)
                    return false;
                // only consider resolutions that have at least one dependent in the satisfied set
                const intersects = [...r.satisfies].some((d) => satisfied.has(d));
                if (!intersects)
                    return false;
                // merging r into candidate is safe only if every dependent r satisfied is also satisfied by candidate
                return [...r.satisfies].every((d) => candidate.satisfies.has(d));
            });
            const megeableResolutions = [
                candidate.resolution.resolution,
                ...mergeable.map((r) => r.resolution.resolution),
            ]
                // stable ordering: sort by version ascending
                .toSorted((a, b) => {
                const va = npmVersions.find((n) => n.resolution.resolution === a).version;
                const vb = npmVersions.find((n) => n.resolution.resolution === b).version;
                return semver.compare(va, vb);
            });
            if (megeableResolutions.length > 1) {
                fixes.push({
                    megeableResolutions,
                    to: candidate.resolution.resolution,
                });
            }
            // mark satisfied dependents as assigned
            for (const d of satisfied)
                unassigned.delete(d);
            if (unassigned.size === 0)
                break;
        }
    }
    return fixes;
}
//# sourceMappingURL=identifyResolutionFixes.js.map