import { renderDuplicatesReport } from "pm-utils";
import type {
  ClusterFix,
  DuplicateDedupeView,
  DuplicatePackageView,
} from "pm-utils";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";

export interface DisplayManyOptions {
  title: "duplicates" | "matches";
  duplicatesPackagesMap: PackagesMap;
  // the declared ranges, not the lockfile's resolved versions: the report has
  // to show what every requester asked for, which is what the fixes reason on
  dependents: DependentRangesMap;
  totalDependencies: number;
  clusterFixes?: ClusterFix[];
  color?: boolean;
  log?: (message?: string) => void;
}

// A cluster of one is the package's own fix: nothing else converges with it, so
// it is rendered in the package's block instead of the cluster section.
const isSingleton = (fix: ClusterFix): boolean => fix.members.length === 1;

const toDedupeViews = (
  packageName: string,
  clusterFixes: ClusterFix[],
): DuplicateDedupeView[] =>
  clusterFixes
    .filter(
      (fix) =>
        isSingleton(fix) &&
        fix.members[0] === packageName &&
        fix.applicable &&
        fix.target !== null,
    )
    .map((fix) => ({
      // the target is what the copies merge into; the other installed versions
      // are what goes away
      from: (fix.memberVersions[packageName]?.versions ?? []).filter(
        (version) => version !== fix.target,
      ),
      to: fix.target!,
      direction: fix.direction,
    }))
    .filter((view) => view.from.length > 0);

const toPackageViews = ({
  duplicatesPackagesMap,
  dependents,
  clusterFixes = [],
}: DisplayManyOptions): DuplicatePackageView[] =>
  Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => {
    if (!resolutions) {
      throw new Error(
        `Unexpected error: no resolutions found for package ${packageName}`,
      );
    }

    return {
      packageName,
      resolutions: resolutions.map(({ resolution, installations }) => ({
        resolution,
        installations,
      })),
      dependents: (dependents.get(packageName) ?? []).map((dependent) => ({
        requester: dependent.key,
        range: dependent.range,
        resolvedVersion: dependent.resolvedVersion,
      })),
      dedupe: toDedupeViews(packageName, clusterFixes),
    };
  });

export const displayMany = (options: DisplayManyOptions): void => {
  renderDuplicatesReport({
    title: options.title,
    packages: toPackageViews(options),
    totalDependencies: options.totalDependencies,
    clusterFixes: (options.clusterFixes ?? []).filter(
      (fix) => !isSingleton(fix),
    ),
    dedupeCommand: "pnpm-dedupe",
    color: options.color,
    log: options.log,
  });
};
