import type { BunLockFile } from "bun";
import { buildLockstepClusters, identifyLockstepClusterFixes } from "pm-utils";
import type {
  ClusterDependentsMap,
  ClusterFix,
  ClusterMembersMap,
} from "pm-utils";
import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import { collectDependents } from "./helpers/collectDependents.ts";
import type { BunLockPackages } from "./helpers/parseBunLockPackages.ts";
import { toLockstepGraph } from "./helpers/toLockstepGraph.ts";

export type {
  ClusterExternalConstraint,
  ClusterFix,
  ClusterReuseFix,
} from "pm-utils";

const toClusterMembers = (
  packagesMap: PackagesMap,
  memberNames: string[],
): ClusterMembersMap =>
  Object.fromEntries(
    memberNames.map((name) => {
      const resolutions = packagesMap[name] ?? [];
      return [
        name,
        {
          npmVersions: resolutions
            .filter((resolution) => resolution.package.type === "npm")
            .map((resolution) =>
              resolution.package.type === "npm"
                ? resolution.package.version
                : "",
            ),
          resolutionCount: resolutions.length,
        },
      ];
    }),
  );

// bun.lock stores the requested ranges in `info.dependencies`, so the dependents
// collected from it already carry real ranges.
const toClusterDependents = (
  packages: BunLockPackages,
  workspaces: BunLockFile["workspaces"],
  memberNames: string[],
): ClusterDependentsMap => {
  const dependents = collectDependents(packages, workspaces, memberNames);

  return new Map(
    [...dependents].map(([name, entries]) => [
      name,
      entries.map((dependent) => ({
        requester: dependent.key,
        requesterName: dependent.bunPackage?.name,
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
    ]),
  );
};

export const identifyClusterFixes = (
  packagesMap: PackagesMap,
  packages: BunLockPackages,
  workspaces: BunLockFile["workspaces"],
): ClusterFix[] => {
  const clusters = buildLockstepClusters(toLockstepGraph(packagesMap));
  if (clusters.length === 0) return [];

  const memberNames = [...new Set(clusters.flat())];

  return identifyLockstepClusterFixes(
    clusters,
    toClusterMembers(packagesMap, memberNames),
    toClusterDependents(packages, workspaces, memberNames),
  );
};
