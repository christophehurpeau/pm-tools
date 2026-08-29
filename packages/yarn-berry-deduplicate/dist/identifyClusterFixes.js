import { buildLockstepClusters, identifyLockstepClusterFixes } from "pm-utils";
import { collectYarnDependents } from "./helpers/collectYarnDependents.js";
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
// yarn.lock stores the requested ranges in each entry's `dependencies` and keys
// every entry by the descriptors that resolve to it, so the dependents
// collected from it already carry real ranges and real resolved versions.
const toClusterDependents = (packages, workspaces, memberNames) => {
    const dependents = collectYarnDependents({
        packages,
        workspaces,
        onlyPackageNames: memberNames,
    });
    return new Map([...dependents].map(([name, entries]) => [
        name,
        entries.map((dependent) => ({
            requester: dependent.key,
            requesterName: dependent.yarnPackage?.name,
            range: dependent.version,
            isAlias: dependent.aliasKey !== undefined,
            resolvedVersion: dependent.resolvedVersion,
            nonSemver: dependent.nonSemver,
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