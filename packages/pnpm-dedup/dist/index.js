import picomatch from "picomatch";
import { displayMany } from "./displayMany.js";
import { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
import { collectDependentRanges } from "./helpers/collectDependentRanges.js";
import { collectPnpmDependents } from "./helpers/collectPnpmDependents.js";
import { identifyDevDependencyFixes } from "./helpers/identifyDevDependencyFixes.js";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
import { createManifestReader } from "./helpers/readInstalledManifest.js";
import { readPnpmLock } from "./readPnpmLock.js";
export { dedupe } from "./dedupe.js";
export { displayMany } from "./displayMany.js";
export { readPnpmLock } from "./readPnpmLock.js";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
export { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.js";
export { collectDependentRanges } from "./helpers/collectDependentRanges.js";
export { identifyDevDependencyFixes } from "./helpers/identifyDevDependencyFixes.js";
export { createManifestReader } from "./helpers/readInstalledManifest.js";
function identifyFixes(lock, duplicatesPackagesMap, projectDir) {
    const duplicateNames = new Set(Object.keys(duplicatesPackagesMap));
    const dependentRanges = collectDependentRanges(lock, duplicateNames, createManifestReader(projectDir));
    return identifyDevDependencyFixes(duplicatesPackagesMap, dependentRanges);
}
export function whyDuplicate(packageNameToFilter, all) {
    const isMatch = picomatch(packageNameToFilter);
    const lock = readPnpmLock();
    const parsed = parsePnpmLockPackages(lock);
    const packagesMap = buildPnpmPackagesMap(parsed);
    const filteredPackages = Object.fromEntries(Object.entries(packagesMap).filter(([packageName, resolutions]) => isMatch(packageName) && (all || resolutions.length > 1)));
    displayMany(all ? "matches" : "duplicates", filteredPackages, collectPnpmDependents(lock, Object.keys(filteredPackages)), identifyFixes(lock, filteredPackages, process.cwd()));
}
export function listDuplicates() {
    const lock = readPnpmLock();
    const parsed = parsePnpmLockPackages(lock);
    const packagesMap = buildPnpmPackagesMap(parsed);
    const duplicatesPackagesMap = filterDuplicatesPnpmPackagesMap(packagesMap);
    const dependents = collectPnpmDependents(lock, Object.keys(duplicatesPackagesMap));
    displayMany("duplicates", duplicatesPackagesMap, dependents, identifyFixes(lock, duplicatesPackagesMap, process.cwd()));
}
//# sourceMappingURL=index.js.map