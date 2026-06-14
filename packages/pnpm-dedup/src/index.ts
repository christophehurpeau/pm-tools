import picomatch from "picomatch";
import { displayMany } from "./displayMany.ts";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.ts";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
import { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
import { readPnpmLock } from "./readPnpmLock.ts";

export { dedupe } from "./dedupe.ts";
export { displayMany } from "./displayMany.ts";
export { readPnpmLock } from "./readPnpmLock.ts";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
export {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
export { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
export { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.ts";

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
  const identifiedFixesMap = buildIdentifiedFixesMap(
    duplicatesPackagesMap,
    dependents,
  );

  displayMany(
    "duplicates",
    duplicatesPackagesMap,
    dependents,
    identifiedFixesMap,
  );
}
