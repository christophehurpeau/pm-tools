import { buildLockstepClusters, identifyLockstepClusterFixes } from "pm-utils";
import type {
  ClusterDependentsMap,
  ClusterFix,
  ClusterMembersMap,
} from "pm-utils";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
import type { ManifestReader } from "./helpers/readInstalledManifest.ts";
import { toLockstepGraph } from "./helpers/toLockstepGraph.ts";
import type { PnpmLockFile } from "./pnpmLockTypes.ts";

export type {
  ClusterExternalConstraint,
  ClusterFix,
  ClusterReuseFix,
} from "pm-utils";

// A lone duplicated package is a cluster of one: nothing co-versions with it,
// but it converges through the same mechanism — the dependents that hold its
// copies apart — and it is applied the same way, by an override the resolver
// then has to confirm.
const singletonClusters = (
  packagesMap: PackagesMap,
  clustered: Set<string>,
): string[][] =>
  Object.entries(packagesMap)
    .filter(
      ([name, resolutions]) =>
        !clustered.has(name) &&
        resolutions.filter((resolution) => resolution.package.type === "npm")
          .length > 1,
    )
    .map(([name]) => [name]);

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
            .map((resolution) => resolution.package.version),
          resolutionCount: resolutions.length,
        },
      ];
    }),
  );

// The pnpm lockfile stores resolved versions, not requested ranges, so the
// constraints have to come from `collectDependentRanges`, which recovers the
// declared range from each requester's installed manifest.
const toClusterDependents = (
  lock: PnpmLockFile,
  memberNames: string[],
  readManifest: ManifestReader,
): ClusterDependentsMap => {
  const ranges = collectDependentRanges(
    lock,
    new Set(memberNames),
    readManifest,
  );

  return new Map(
    [...ranges].map(([name, dependents]) => [
      name,
      dependents.map((dependent) => ({
        requester: dependent.key,
        requesterName: dependent.requesterName,
        range: dependent.range,
        resolvedVersion: dependent.resolvedVersion,
        workspace: dependent.workspace,
      })),
    ]),
  );
};

export const identifyClusterFixes = (
  lock: PnpmLockFile,
  packagesMap: PackagesMap,
  readManifest: ManifestReader,
): ClusterFix[] => {
  const lockstepClusters = buildLockstepClusters(
    toLockstepGraph(lock, packagesMap),
  );
  const clusters = [
    ...lockstepClusters,
    ...singletonClusters(packagesMap, new Set(lockstepClusters.flat())),
  ];
  if (clusters.length === 0) return [];

  const memberNames = [...new Set(clusters.flat())];

  return identifyLockstepClusterFixes(
    clusters,
    toClusterMembers(packagesMap, memberNames),
    toClusterDependents(lock, memberNames, readManifest),
    // A lone duplicate that only converges by editing a range the workspace
    // declares is an upgrade of a direct dependency, not a dedupe: that pin is
    // the whole decision here, where in a family it is one constraint among
    // many. Left to the user.
  ).filter(
    (fix) => fix.members.length > 1 || fix.workspaceChanges.length === 0,
  );
};
