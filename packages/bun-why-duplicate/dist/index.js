import { Glob } from "bun";
import { displayMany } from "./displayMany.js";
import { applyIdentifiedFixesToBunLock } from "./helpers/applyIdentifiedFixesToBunLock.js";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.js";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./helpers/buildPackagesMap.js";
import { collectDependents } from "./helpers/collectDependents.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { writeBunLockFile } from "./helpers/writeBunLockFile.js";
import { identifyResolutionFixes } from "./identifyResolutionFixes.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
export { displayMany } from "./displayMany.js";
export { readAndParseBunLock } from "./readAndParseBunLock.js";
export { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
export { buildPackagesMap } from "./helpers/buildPackagesMap.js";
export { collectDependents } from "./helpers/collectDependents.js";
export { identifyResolutionFixes } from "./identifyResolutionFixes.js";
export { writeBunLockFile } from "./helpers/writeBunLockFile.js";
export function whyDuplicate(packageNameToFilter, all) {
    const glob = new Glob(packageNameToFilter);
    const bunLockResult = readAndParseBunLock();
    const packages = parseBunLockPackages(bunLockResult);
    const packagesMap = buildPackagesMap(packages);
    const filteredPackages = Object.fromEntries(Object.entries(packagesMap).filter(([packageName, resolutions]) => glob.match(packageName) && (all || resolutions.length > 1)));
    displayMany(all ? "matches" : "duplicates", filteredPackages, collectDependents(packages, bunLockResult.workspaces, Object.keys(filteredPackages)));
}
export function listDuplicates() {
    const bunLockResult = readAndParseBunLock();
    const packages = parseBunLockPackages(bunLockResult);
    const packagesMap = buildPackagesMap(packages);
    const duplicatesPackagesMap = filterDuplicatesPackagesMap(packagesMap);
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(duplicatesPackagesMap));
    const identifedFixesMap = new Map(Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => [
        packageName,
        identifyResolutionFixes(resolutions, dependents),
    ]));
    displayMany("duplicates", duplicatesPackagesMap, dependents, identifedFixesMap);
}
export function fixDuplicates(dryRun = false) {
    const bunLockResult = readAndParseBunLock();
    const packages = parseBunLockPackages(bunLockResult);
    const packagesMap = buildPackagesMap(packages);
    const duplicatesPackagesMap = filterDuplicatesPackagesMap(packagesMap);
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(duplicatesPackagesMap));
    const identifiedFixesMap = buildIdentifiedFixesMap(duplicatesPackagesMap, dependents);
    const result = applyIdentifiedFixesToBunLock(bunLockResult, identifiedFixesMap);
    if (result.changed) {
        if (dryRun) {
            console.log("Dry run: would update bun.lock for entries:", result.changedKeys.join(", "));
        }
        else {
            writeBunLockFile(bunLockResult);
            console.log("bun.lock updated");
            console.log("Please run `bun i` to apply the changes");
            console.log("If you want to format properly bun.lock again, you need to update a dependency", " eg (`bun update typescript && bun i`)");
        }
    }
    else {
        console.log("Nothing safe to dedupe identified");
    }
}
//# sourceMappingURL=index.js.map