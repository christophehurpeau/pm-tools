import { renderDuplicatesReport } from "pm-utils";
import type {
  ClusterFix,
  DuplicateDedupeView,
  DuplicatePackageView,
} from "pm-utils";
import semver from "semver";
import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectDependents.ts";
import type { ResolutionFix } from "./identifyResolutionFixes.ts";

export interface DisplayManyOptions {
  title: "duplicates" | "matches";
  duplicatesPackagesMap: PackagesMap;
  dependents: DependentsMap;
  totalDependencies: number;
  identifiedFixesMap?: Map<string, ResolutionFix[]>;
  clusterFixes?: ClusterFix[];
  color?: boolean;
  log?: (message?: string) => void;
}

// the fixes carry full resolutions (`metro@0.84.5`); the report shows versions,
// the package name being the block it sits under
const stripName = (packageName: string, resolution: string): string =>
  resolution.startsWith(`${packageName}@`)
    ? resolution.slice(packageName.length + 1)
    : resolution;

const toDedupeViews = (
  packageName: string,
  fixes: ResolutionFix[] | undefined,
): DuplicateDedupeView[] =>
  (fixes ?? []).map((fix) => {
    const from = fix.megeableResolutions
      .filter((resolution) => resolution !== fix.to)
      .map((resolution) => stripName(packageName, resolution));
    const to = stripName(packageName, fix.to);
    return {
      from,
      to,
      // merging onto a lower installed version is legitimate here — the copy is
      // already in the lockfile — but it is a downgrade for whoever resolved
      // higher, so it is named
      direction: from.some((version) => semver.gt(version, to)) ? "down" : "up",
    };
  });

const toPackageViews = ({
  duplicatesPackagesMap,
  dependents,
  identifiedFixesMap,
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
        range: dependent.version,
        resolvedVersion: dependent.resolvedVersion,
      })),
      dedupe: toDedupeViews(
        packageName,
        identifiedFixesMap?.get(packageName),
      ).filter((view) => view.from.length > 0),
    };
  });

export const displayMany = (options: DisplayManyOptions): void => {
  renderDuplicatesReport({
    title: options.title,
    packages: toPackageViews(options),
    totalDependencies: options.totalDependencies,
    clusterFixes: options.clusterFixes,
    dedupeCommand: "bun-dedupe",
    color: options.color,
    log: options.log,
  });
};
