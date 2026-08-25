import { buildLockstepClusters, identifyLockstepClusterFixes } from "pm-utils";
import { collectDependentRanges } from "./helpers/collectDependentRanges.js";
import { toLockstepGraph } from "./helpers/toLockstepGraph.js";
// A lone duplicated package is a cluster of one: nothing co-versions with it,
// but it converges through the same mechanism — the dependents that hold its
// copies apart — and it is applied the same way, by an override the resolver
// then has to confirm.
const singletonClusters = (packagesMap, clustered) => Object.entries(packagesMap)
    .filter(([name, resolutions]) => !clustered.has(name) &&
    resolutions.filter((resolution) => resolution.package.type === "npm")
        .length > 1)
    .map(([name]) => [name]);
const toClusterMembers = (packagesMap, memberNames) => Object.fromEntries(memberNames.map((name) => {
    const resolutions = packagesMap[name] ?? [];
    return [
        name,
        {
            npmVersions: resolutions
                .filter((resolution) => resolution.package.type === "npm")
                .map((resolution) => resolution.package.version),
            resolutionCount: resolutions.length,
        },
    ];
}));
// The pnpm lockfile stores resolved versions, not requested ranges, so the
// constraints have to come from `collectDependentRanges`, which recovers the
// declared range from each requester's installed manifest.
const toClusterDependents = (lock, memberNames, readManifest) => {
    const ranges = collectDependentRanges(lock, new Set(memberNames), readManifest);
    return new Map([...ranges].map(([name, dependents]) => [
        name,
        dependents.map((dependent) => ({
            requester: dependent.key,
            requesterName: dependent.requesterName,
            range: dependent.range,
            resolvedVersion: dependent.resolvedVersion,
            workspace: dependent.workspace,
        })),
    ]));
};
export const identifyClusterFixes = (lock, packagesMap, readManifest) => {
    const lockstepClusters = buildLockstepClusters(toLockstepGraph(lock, packagesMap));
    const clusters = [
        ...lockstepClusters,
        ...singletonClusters(packagesMap, new Set(lockstepClusters.flat())),
    ];
    if (clusters.length === 0)
        return [];
    const memberNames = [...new Set(clusters.flat())];
    return identifyLockstepClusterFixes(clusters, toClusterMembers(packagesMap, memberNames), toClusterDependents(lock, memberNames, readManifest)).filter((fix) => fix.members.length > 1 || fix.workspaceChanges.length === 0);
};
//# sourceMappingURL=identifyClusterFixes.js.map