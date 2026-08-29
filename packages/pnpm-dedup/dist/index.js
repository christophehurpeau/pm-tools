import { createPackageFilter, selectExplainedPackages, selectPackages, } from "pm-utils";
import { displayMany } from "./displayMany.js";
import { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
import { collectDependentRanges } from "./helpers/collectDependentRanges.js";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
import { lockPathOf, resolvePnpmProjectDir } from "./helpers/projectDir.js";
import { createManifestReaderWithStats } from "./helpers/readInstalledManifest.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readPnpmLock } from "./readPnpmLock.js";
export { dedupe } from "./dedupe.js";
export { applyClusterFixes } from "./applyClusterFixes.js";
export { identifyClusterFixes } from "./identifyClusterFixes.js";
export { toLockstepGraph } from "./helpers/toLockstepGraph.js";
export { displayMany } from "./displayMany.js";
export { readPnpmLock } from "./readPnpmLock.js";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
export { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.js";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.js";
export { collectDependentRanges } from "./helpers/collectDependentRanges.js";
export { readVersionsSnapshot } from "./helpers/versionsSnapshot.js";
export { createManifestReader, createManifestReaderWithStats, } from "./helpers/readInstalledManifest.js";
/**
 * Every declared range of a transitive dependent is read from its installed
 * manifest; the lockfile only stores resolved versions. When nothing is
 * readable, each range degrades to an exact version and the reported fixes are
 * not merely fewer but wrong — so say so instead of printing a confident answer.
 */
function warnWhenNoManifests(stats) {
    if (stats.found > 0 || stats.missed === 0)
        return;
    console.log();
    console.log("Warning: no installed manifest could be read under node_modules, so every dependent's range fell back to its resolved version and the fixes above are unreliable. Run `pnpm install` first.");
}
// The report and the fixes must agree on what every requester asked for, so
// both read the declared ranges the lockfile does not store.
function collectRanges(lock, packagesMap, readManifest) {
    return collectDependentRanges(lock, new Set(Object.keys(packagesMap)), readManifest);
}
export function whyDuplicate({ filter: filterOptions, all = false, details = false, }) {
    const filter = createPackageFilter(filterOptions);
    const projectDir = resolvePnpmProjectDir();
    if (projectDir === null)
        return;
    const lock = readPnpmLock(lockPathOf(projectDir));
    const parsed = parsePnpmLockPackages(lock);
    const packagesMap = buildPnpmPackagesMap(parsed);
    const { packages: filteredPackages, title, notice, } = selectExplainedPackages({ packagesMap, filter, all });
    const { readManifest, stats } = createManifestReaderWithStats(projectDir);
    // A duplicate is often only explainable by its family: show the cluster fixes
    // covering the matched packages, not just their own dependents.
    const matchedClusterFixes = identifyClusterFixes(lock, packagesMap, readManifest).filter((fix) => fix.members.some(filter.selects));
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
export function listDuplicates({ filter: filterOptions, details = false, } = {}) {
    const filter = createPackageFilter(filterOptions);
    const projectDir = resolvePnpmProjectDir();
    if (projectDir === null)
        return;
    const lock = readPnpmLock(lockPathOf(projectDir));
    const parsed = parsePnpmLockPackages(lock);
    const packagesMap = buildPnpmPackagesMap(parsed);
    const duplicatesPackagesMap = selectPackages(filterDuplicatesPnpmPackagesMap(packagesMap), filter);
    const { readManifest, stats } = createManifestReaderWithStats(projectDir);
    displayMany({
        title: "duplicates",
        duplicatesPackagesMap,
        dependents: collectRanges(lock, duplicatesPackagesMap, readManifest),
        totalDependencies: Object.keys(packagesMap).length,
        // as in `whyDuplicate`: a family is shown whole as soon as it holds a
        // selected member, because that is what explains the duplicate
        clusterFixes: identifyClusterFixes(lock, packagesMap, readManifest).filter((fix) => fix.members.some(filter.selects)),
        details,
    });
    warnWhenNoManifests(stats());
}
//# sourceMappingURL=index.js.map