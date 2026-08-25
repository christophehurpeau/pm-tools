import { buildLockstepClusters, identifyLockstepClusterFixes } from "pm-utils";
import { collectDependents } from "./helpers/collectDependents.js";
import { toLockstepGraph } from "./helpers/toLockstepGraph.js";
const toClusterMembers = (packagesMap, memberNames) => Object.fromEntries(memberNames.map((name) => {
    const resolutions = packagesMap[name] ?? [];
    return [
        name,
        {
            npmVersions: resolutions
                .filter((resolution) => resolution.package.type === "npm")
                .map((resolution) => resolution.package.type === "npm"
                ? resolution.package.version
                : ""),
            resolutionCount: resolutions.length,
        },
    ];
}));
// bun.lock stores the requested ranges in `info.dependencies`, so the dependents
// collected from it already carry real ranges.
const toClusterDependents = (packages, workspaces, memberNames) => {
    const dependents = collectDependents(packages, workspaces, memberNames);
    return new Map([...dependents].map(([name, entries]) => [
        name,
        entries.map((dependent) => ({
            requester: dependent.key,
            requesterName: dependent.bunPackage?.name,
            range: dependent.version,
            resolvedVersion: dependent.resolvedVersion,
            workspace: dependent.workspace
                ? {
                    path: dependent.workspace.path,
                    depType: dependent.workspace.depType,
                }
                : undefined,
        })),
    ]));
};
export const identifyClusterFixes = (packagesMap, packages, workspaces) => {
    const clusters = buildLockstepClusters(toLockstepGraph(packagesMap));
    if (clusters.length === 0)
        return [];
    const memberNames = [...new Set(clusters.flat())];
    return identifyLockstepClusterFixes(clusters, toClusterMembers(packagesMap, memberNames), toClusterDependents(packages, workspaces, memberNames));
};
//# sourceMappingURL=identifyClusterFixes.js.map