import {
  createPackageFilter,
  selectExplainedPackages,
  selectPackages,
} from "pm-utils";
import type { PackageFilterOptions } from "pm-utils";
import { displayMany } from "./displayMany.ts";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
import { lockPathOf, resolvePnpmProjectDir } from "./helpers/projectDir.ts";
import type {
  ManifestReader,
  ManifestReaderStats,
} from "./helpers/readInstalledManifest.ts";
import { createManifestReaderWithStats } from "./helpers/readInstalledManifest.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import type { PnpmLockFile } from "./pnpmLockTypes.ts";
import { readPnpmLock } from "./readPnpmLock.ts";

export { dedupe } from "./dedupe.ts";
export { applyClusterFixes } from "./applyClusterFixes.ts";
export { identifyClusterFixes } from "./identifyClusterFixes.ts";
export { toLockstepGraph } from "./helpers/toLockstepGraph.ts";
export { displayMany } from "./displayMany.ts";
export { readPnpmLock } from "./readPnpmLock.ts";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
export {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
export { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
export { readVersionsSnapshot } from "./helpers/versionsSnapshot.ts";
export {
  createManifestReader,
  createManifestReaderWithStats,
} from "./helpers/readInstalledManifest.ts";

/**
 * Every declared range of a transitive dependent is read from its installed
 * manifest; the lockfile only stores resolved versions. When nothing is
 * readable, each range degrades to an exact version and the reported fixes are
 * not merely fewer but wrong — so say so instead of printing a confident answer.
 */
function warnWhenNoManifests(stats: ManifestReaderStats): void {
  if (stats.found > 0 || stats.missed === 0) return;
  console.log();
  console.log(
    "Warning: no installed manifest could be read under node_modules, so every dependent's range fell back to its resolved version and the fixes above are unreliable. Run `pnpm install` first.",
  );
}

// The report and the fixes must agree on what every requester asked for, so
// both read the declared ranges the lockfile does not store.
function collectRanges(
  lock: PnpmLockFile,
  packagesMap: PackagesMap,
  readManifest: ManifestReader,
): DependentRangesMap {
  return collectDependentRanges(
    lock,
    new Set(Object.keys(packagesMap)),
    readManifest,
  );
}

export interface WhyDuplicateOptions {
  filter?: PackageFilterOptions;
  // keeps packages the lockfile resolves only once, which a listing drops
  all?: boolean;
  // every dependent of every version, instead of one line per package
  details?: boolean;
}

export function whyDuplicate({
  filter: filterOptions,
  all = false,
  details = false,
}: WhyDuplicateOptions): void {
  const filter = createPackageFilter(filterOptions);

  const projectDir = resolvePnpmProjectDir();
  if (projectDir === null) return;
  const lock = readPnpmLock(lockPathOf(projectDir));
  const parsed = parsePnpmLockPackages(lock);
  const packagesMap = buildPnpmPackagesMap(parsed);

  const {
    packages: filteredPackages,
    title,
    notice,
  } = selectExplainedPackages({ packagesMap, filter, all });

  const { readManifest, stats } = createManifestReaderWithStats(projectDir);

  // A duplicate is often only explainable by its family: show the cluster fixes
  // covering the matched packages, not just their own dependents.
  const matchedClusterFixes = identifyClusterFixes(
    lock,
    packagesMap,
    readManifest,
  ).filter((fix) => fix.members.some(filter.selects));

  displayMany({
    title,
    notice,
    duplicatesPackagesMap: filteredPackages,
    dependents: collectRanges(lock, filteredPackages, readManifest),
    // the whole lockfile, so the count means the same whatever the filter
    totalDependencies: Object.keys(packagesMap).length,
    clusterFixes: matchedClusterFixes,
    details,
  });
  warnWhenNoManifests(stats());
}

export interface ListDuplicatesOptions {
  filter?: PackageFilterOptions;
  details?: boolean;
}

export function listDuplicates({
  filter: filterOptions,
  details = false,
}: ListDuplicatesOptions = {}): void {
  const filter = createPackageFilter(filterOptions);

  const projectDir = resolvePnpmProjectDir();
  if (projectDir === null) return;
  const lock = readPnpmLock(lockPathOf(projectDir));
  const parsed = parsePnpmLockPackages(lock);
  const packagesMap = buildPnpmPackagesMap(parsed);
  const duplicatesPackagesMap = selectPackages(
    filterDuplicatesPnpmPackagesMap(packagesMap),
    filter,
  );

  const { readManifest, stats } = createManifestReaderWithStats(projectDir);

  displayMany({
    title: "duplicates",
    duplicatesPackagesMap,
    dependents: collectRanges(lock, duplicatesPackagesMap, readManifest),
    totalDependencies: Object.keys(packagesMap).length,
    // as in `whyDuplicate`: a family is shown whole as soon as it holds a
    // selected member, because that is what explains the duplicate
    clusterFixes: identifyClusterFixes(lock, packagesMap, readManifest).filter(
      (fix) => fix.members.some(filter.selects),
    ),
    details,
  });
  warnWhenNoManifests(stats());
}
