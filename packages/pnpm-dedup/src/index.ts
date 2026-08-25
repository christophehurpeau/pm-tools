import picomatch from "picomatch";
import { displayMany } from "./displayMany.ts";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
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

export function whyDuplicate(packageNameToFilter: string, all: boolean): void {
  const isMatch = picomatch(packageNameToFilter);

  const lock = readPnpmLock();
  const parsed = parsePnpmLockPackages(lock);
  const packagesMap = buildPnpmPackagesMap(parsed);

  const filteredPackages = Object.fromEntries(
    Object.entries(packagesMap).filter(
      ([packageName, resolutions]) =>
        isMatch(packageName) && (all || resolutions.length > 1),
    ),
  );

  const { readManifest, stats } = createManifestReaderWithStats(process.cwd());

  // A duplicate is often only explainable by its family: show the cluster fixes
  // covering the matched packages, not just their own dependents.
  const matchedClusterFixes = identifyClusterFixes(
    lock,
    packagesMap,
    readManifest,
  ).filter((fix) => fix.members.some((member) => isMatch(member)));

  displayMany({
    title: all ? "matches" : "duplicates",
    duplicatesPackagesMap: filteredPackages,
    dependents: collectRanges(lock, filteredPackages, readManifest),
    // the whole lockfile, so the count means the same whatever the filter
    totalDependencies: Object.keys(packagesMap).length,
    clusterFixes: matchedClusterFixes,
  });
  warnWhenNoManifests(stats());
}

export function listDuplicates(): void {
  const lock = readPnpmLock();
  const parsed = parsePnpmLockPackages(lock);
  const packagesMap = buildPnpmPackagesMap(parsed);
  const duplicatesPackagesMap = filterDuplicatesPnpmPackagesMap(packagesMap);

  const { readManifest, stats } = createManifestReaderWithStats(process.cwd());

  displayMany({
    title: "duplicates",
    duplicatesPackagesMap,
    dependents: collectRanges(lock, duplicatesPackagesMap, readManifest),
    totalDependencies: Object.keys(packagesMap).length,
    clusterFixes: identifyClusterFixes(lock, packagesMap, readManifest),
  });
  warnWhenNoManifests(stats());
}
