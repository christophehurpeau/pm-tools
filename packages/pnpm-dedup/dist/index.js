import picomatch from "picomatch";
import { displayMany } from "./displayMany.js";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.js";
import { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
import { collectPnpmDependents } from "./helpers/collectPnpmDependents.js";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
import { readPnpmLock } from "./readPnpmLock.js";
export { dedupe } from "./dedupe.js";
export { displayMany } from "./displayMany.js";
export { readPnpmLock } from "./readPnpmLock.js";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
export { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.js";
export { identifyResolutionFixes } from "./identifyResolutionFixes.js";
export { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.js";
export function whyDuplicate(packageNameToFilter, all) {
    const isMatch = picomatch(packageNameToFilter);
    const lock = readPnpmLock();
    const parsed = parsePnpmLockPackages(lock);
    const packagesMap = buildPnpmPackagesMap(parsed);
    const filteredPackages = Object.fromEntries(Object.entries(packagesMap).filter(([packageName, resolutions]) => isMatch(packageName) && (all || resolutions.length > 1)));
    displayMany(all ? "matches" : "duplicates", filteredPackages, collectPnpmDependents(lock, Object.keys(filteredPackages)));
}
export function listDuplicates() {
    const lock = readPnpmLock();
    const parsed = parsePnpmLockPackages(lock);
    const packagesMap = buildPnpmPackagesMap(parsed);
    const duplicatesPackagesMap = filterDuplicatesPnpmPackagesMap(packagesMap);
    const dependents = collectPnpmDependents(lock, Object.keys(duplicatesPackagesMap));
    const identifiedFixesMap = buildIdentifiedFixesMap(duplicatesPackagesMap, dependents);
    displayMany("duplicates", duplicatesPackagesMap, dependents, identifiedFixesMap);
}
//# sourceMappingURL=index.js.map