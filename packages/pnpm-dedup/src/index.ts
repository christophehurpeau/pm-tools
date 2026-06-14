import picomatch from "picomatch";
import { displayMany } from "./displayMany.ts";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
import { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
import { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
import { identifyDevDependencyFixes } from "./helpers/identifyDevDependencyFixes.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
import { createManifestReader } from "./helpers/readInstalledManifest.ts";
import type { PnpmLockFile } from "./pnpmLockTypes.ts";
import { readPnpmLock } from "./readPnpmLock.ts";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";

export { dedupe } from "./dedupe.ts";
export { displayMany } from "./displayMany.ts";
export { readPnpmLock } from "./readPnpmLock.ts";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
export {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
export { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
export { identifyDevDependencyFixes } from "./helpers/identifyDevDependencyFixes.ts";
export { createManifestReader } from "./helpers/readInstalledManifest.ts";

function identifyFixes(
  lock: PnpmLockFile,
  duplicatesPackagesMap: PackagesMap,
  projectDir: string,
): ReturnType<typeof identifyDevDependencyFixes> {
  const duplicateNames = new Set(Object.keys(duplicatesPackagesMap));
  const dependentRanges = collectDependentRanges(
    lock,
    duplicateNames,
    createManifestReader(projectDir),
  );
  return identifyDevDependencyFixes(duplicatesPackagesMap, dependentRanges);
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

  displayMany(
    all ? "matches" : "duplicates",
    filteredPackages,
    collectPnpmDependents(lock, Object.keys(filteredPackages)),
    identifyFixes(lock, filteredPackages, process.cwd()),
  );
}

export function listDuplicates(): void {
  const lock = readPnpmLock();
  const parsed = parsePnpmLockPackages(lock);
  const packagesMap = buildPnpmPackagesMap(parsed);
  const duplicatesPackagesMap = filterDuplicatesPnpmPackagesMap(packagesMap);
  const dependents = collectPnpmDependents(
    lock,
    Object.keys(duplicatesPackagesMap),
  );

  displayMany(
    "duplicates",
    duplicatesPackagesMap,
    dependents,
    identifyFixes(lock, duplicatesPackagesMap, process.cwd()),
  );
}
