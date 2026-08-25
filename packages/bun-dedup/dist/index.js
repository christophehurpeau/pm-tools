import { Glob } from "bun";
import { renderApplyPlan } from "pm-utils";
import { applyClusterFixes } from "./applyClusterFixes.js";
import { displayMany } from "./displayMany.js";
import { applyIdentifiedFixesToBunLock } from "./helpers/applyIdentifiedFixesToBunLock.js";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.js";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./helpers/buildPackagesMap.js";
import { collectDependents } from "./helpers/collectDependents.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { writeBunLockFile } from "./helpers/writeBunLockFile.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { identifyResolutionFixes } from "./identifyResolutionFixes.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
export { displayMany } from "./displayMany.js";
export { applyClusterFixes } from "./applyClusterFixes.js";
export { readAndParseBunLock } from "./readAndParseBunLock.js";
export { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
export { buildPackagesMap } from "./helpers/buildPackagesMap.js";
export { collectDependents } from "./helpers/collectDependents.js";
export { identifyResolutionFixes } from "./identifyResolutionFixes.js";
export { identifyClusterFixes } from "./identifyClusterFixes.js";
export { writeBunLockFile } from "./helpers/writeBunLockFile.js";
export function whyDuplicate(packageNameToFilter, all) {
    const glob = new Glob(packageNameToFilter);
    const bunLockResult = readAndParseBunLock();
    const packages = parseBunLockPackages(bunLockResult);
    const packagesMap = buildPackagesMap(packages);
    const filteredPackages = Object.fromEntries(Object.entries(packagesMap).filter(([packageName, resolutions]) => glob.match(packageName) && (all || resolutions.length > 1)));
    // A duplicate is often only explainable by its family: show the cluster fixes
    // covering the matched packages, not just their own dependents.
    const matchedClusterFixes = identifyClusterFixes(packagesMap, packages, bunLockResult.workspaces).filter((fix) => fix.members.some((member) => glob.match(member)));
    displayMany({
        title: all ? "matches" : "duplicates",
        duplicatesPackagesMap: filteredPackages,
        dependents: collectDependents(packages, bunLockResult.workspaces, Object.keys(filteredPackages)),
        // the whole lockfile, so the count means the same whatever the filter
        totalDependencies: Object.keys(packagesMap).length,
        clusterFixes: matchedClusterFixes,
    });
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
    const clusterFixes = identifyClusterFixes(packagesMap, packages, bunLockResult.workspaces);
    displayMany({
        title: "duplicates",
        duplicatesPackagesMap,
        dependents,
        totalDependencies: Object.keys(packagesMap).length,
        identifiedFixesMap: identifedFixesMap,
        clusterFixes,
    });
}
// Reads bun.lock as it stands on disk and applies the pure-lock fixes to the
// parsed copy. In memory only: nothing reaches disk until `writeBunLockFile`,
// so this doubles as the dry-run probe.
const planLockRewrite = () => {
    const bunLockResult = readAndParseBunLock();
    const packages = parseBunLockPackages(bunLockResult);
    const packagesMap = buildPackagesMap(packages);
    const duplicatesPackagesMap = filterDuplicatesPackagesMap(packagesMap);
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(duplicatesPackagesMap));
    const lockResult = applyIdentifiedFixesToBunLock(bunLockResult, buildIdentifiedFixesMap(duplicatesPackagesMap, dependents));
    return {
        bunLockResult,
        lockResult,
        residuals: lockResult.changed
            ? `bun.lock would be rewritten for ${lockResult.changedKeys.length} entrie(s): ${lockResult.changedKeys.join(", ")}`
            : undefined,
    };
};
// Cluster fixes go first: they are the only pass that can reach a version the
// lockfile does not carry, and the pure-lock pass then collapses the leaves bun
// did not merge on its own.
export function fixDuplicates({ mode = "apply", clusters = true, } = {}) {
    const dryRun = mode !== "apply";
    // Only a dry run needs the residuals up front, to name them in the plan the
    // cluster pass prints. An apply plans the rewrite *after* the cluster pass,
    // against the lockfile `bun install` left behind.
    const probe = dryRun ? planLockRewrite() : null;
    const clusterOutcome = clusters
        ? applyClusterFixes({
            projectDir: process.cwd(),
            dryRun,
            packageManagerResiduals: probe?.residuals,
        })
        : null;
    if (clusterOutcome?.status === "applied") {
        console.log(`Cluster fixes: ${clusterOutcome.before.size} duplicate resolutions -> ${clusterOutcome.after.size}`);
    }
    if (dryRun) {
        // the cluster pass renders the plan; without it there is nothing else to say
        if (!clusters) {
            renderApplyPlan({
                fileChanges: [],
                packageManagerResiduals: probe?.residuals,
                dedupeCommand: "bun-dedupe",
            });
        }
        if (mode === "check") {
            process.exitCode =
                (clusterOutcome?.plannedChangeCount ?? 0) > 0 ||
                    (probe?.lockResult.changed ?? false)
                    ? 1
                    : 0;
        }
        return;
    }
    // The cluster pass runs `bun install`, which rewrites bun.lock on disk — so
    // the pure-lock pass has to plan against the file as it stands now. Planning
    // it earlier and writing that copy back would clobber the cluster result.
    const { bunLockResult, lockResult } = planLockRewrite();
    if (lockResult.changed) {
        writeBunLockFile(bunLockResult);
        console.log("bun.lock updated");
        console.log("Please run `bun i` to apply the changes");
        console.log("If you want to format properly bun.lock again, you need to update a dependency", " eg (`bun update typescript && bun i`)");
    }
    else {
        console.log("Nothing safe to dedupe identified");
    }
}
//# sourceMappingURL=index.js.map