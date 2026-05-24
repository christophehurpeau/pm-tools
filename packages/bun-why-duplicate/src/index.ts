import { Glob } from "bun";
import { displayMany } from "./displayMany.ts";
import { applyIdentifiedFixesToBunLock } from "./helpers/applyIdentifiedFixesToBunLock.ts";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.ts";
import {
  buildPackagesMap,
  filterDuplicatesPackagesMap,
} from "./helpers/buildPackagesMap.ts";
import { collectDependents } from "./helpers/collectDependents.ts";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
import { writeBunLockFile } from "./helpers/writeBunLockFile.ts";
import { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
import { readAndParseBunLock } from "./readAndParseBunLock.ts";

export { displayMany } from "./displayMany.ts";
export { readAndParseBunLock } from "./readAndParseBunLock.ts";
export { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
export { buildPackagesMap } from "./helpers/buildPackagesMap.ts";
export { collectDependents } from "./helpers/collectDependents.ts";
export { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
export { writeBunLockFile } from "./helpers/writeBunLockFile.ts";

export function whyDuplicate(packageNameToFilter: string, all: boolean): void {
  const glob = new Glob(packageNameToFilter);

  const bunLockResult = readAndParseBunLock();
  const packages = parseBunLockPackages(bunLockResult);
  const packagesMap = buildPackagesMap(packages);

  const filteredPackages = Object.fromEntries(
    Object.entries(packagesMap).filter(
      ([packageName, resolutions]) =>
        glob.match(packageName) && (all || resolutions.length > 1),
    ),
  );

  displayMany(
    all ? "matches" : "duplicates",
    filteredPackages,
    collectDependents(
      packages,
      bunLockResult.workspaces,
      Object.keys(filteredPackages),
    ),
  );
}

export function listDuplicates(): void {
  const bunLockResult = readAndParseBunLock();
  const packages = parseBunLockPackages(bunLockResult);
  const packagesMap = buildPackagesMap(packages);
  const duplicatesPackagesMap = filterDuplicatesPackagesMap(packagesMap);
  const dependents = collectDependents(
    packages,
    bunLockResult.workspaces,
    Object.keys(duplicatesPackagesMap),
  );
  const identifedFixesMap = new Map<
    string,
    ReturnType<typeof identifyResolutionFixes>
  >(
    Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => [
      packageName,
      identifyResolutionFixes(resolutions, dependents),
    ]),
  );

  displayMany(
    "duplicates",
    duplicatesPackagesMap,
    dependents,
    identifedFixesMap,
  );
}

export function fixDuplicates(dryRun = false): void {
  const bunLockResult = readAndParseBunLock();
  const packages = parseBunLockPackages(bunLockResult);
  const packagesMap = buildPackagesMap(packages);
  const duplicatesPackagesMap = filterDuplicatesPackagesMap(packagesMap);

  const dependents = collectDependents(
    packages,
    bunLockResult.workspaces,
    Object.keys(duplicatesPackagesMap),
  );

  const identifiedFixesMap = buildIdentifiedFixesMap(
    duplicatesPackagesMap,
    dependents,
  );

  const result = applyIdentifiedFixesToBunLock(
    bunLockResult,
    identifiedFixesMap,
  );

  if (result.changed) {
    if (dryRun) {
      console.log(
        "Dry run: would update bun.lock for entries:",
        result.changedKeys.join(", "),
      );
    } else {
      writeBunLockFile(bunLockResult);
      console.log("bun.lock updated");
      console.log("Please run `bun i` to apply the changes");
      console.log(
        "If you want to format properly bun.lock again, you need to update a dependency",
        " eg (`bun update typescript && bun i`)",
      );
    }
  } else {
    console.log("Nothing safe to dedupe identified");
  }
}
