import { buildIdentifiedFixesMap, countDuplicatedPackages, createPackageFilter, diffVersionsSnapshots, renderApplyPlan, renderDedupeSummary, selectExplainedPackages, selectPackages, } from "pm-utils";
import { applyClusterFixes } from "./applyClusterFixes.js";
import { displayMany } from "./displayMany.js";
import { applyIdentifiedFixesToBunLock } from "./helpers/applyIdentifiedFixesToBunLock.js";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./helpers/buildPackagesMap.js";
import { collectDependents } from "./helpers/collectDependents.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { lockPathOf, resolveBunProjectDir } from "./helpers/projectDir.js";
import { readVersionsSnapshot, versionsSnapshotOf, } from "./helpers/versionsSnapshot.js";
import { writeBunLockFile } from "./helpers/writeBunLockFile.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
export { displayMany } from "./displayMany.js";
export { applyClusterFixes } from "./applyClusterFixes.js";
export { readAndParseBunLock } from "./readAndParseBunLock.js";
export { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
export { buildPackagesMap } from "./helpers/buildPackagesMap.js";
export { collectDependents } from "./helpers/collectDependents.js";
export { readVersionsSnapshot, versionsSnapshotOf, } from "./helpers/versionsSnapshot.js";
export { identifyResolutionFixes } from "pm-utils";
export { identifyClusterFixes } from "./identifyClusterFixes.js";
export { writeBunLockFile } from "./helpers/writeBunLockFile.js";
const readProject = (projectDir) => {
    const bunLockResult = readAndParseBunLock(lockPathOf(projectDir));
    const packages = parseBunLockPackages(bunLockResult);
    return { bunLockResult, packages, packagesMap: buildPackagesMap(packages) };
};
export function whyDuplicate({ filter: filterOptions, all = false, details = false, }) {
    const filter = createPackageFilter(filterOptions);
    const projectDir = resolveBunProjectDir();
    if (projectDir === null)
        return;
    const { bunLockResult, packages, packagesMap } = readProject(projectDir);
    const { packages: filteredPackages, title, notice, } = selectExplainedPackages({ packagesMap, filter, all });
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(filteredPackages));
    // A duplicate is often only explainable by its family: show the cluster fixes
    // covering the matched packages, not just their own dependents.
    const matchedClusterFixes = identifyClusterFixes(packagesMap, packages, bunLockResult.workspaces).filter((fix) => fix.members.some(filter.selects));
    displayMany({
        title,
        notice,
        duplicatesPackagesMap: filteredPackages,
        dependents,
        // the whole lockfile, so the count means the same whatever the filter
        totalDependencies: Object.keys(packagesMap).length,
        // the same fixes the listing shows: explaining one package is no reason to
        // stay silent on what would collapse it
        identifiedFixesMap: buildIdentifiedFixesMap(filteredPackages, dependents),
        clusterFixes: matchedClusterFixes,
        details,
    });
}
export function listDuplicates({ filter: filterOptions, details = false, } = {}) {
    const filter = createPackageFilter(filterOptions);
    const projectDir = resolveBunProjectDir();
    if (projectDir === null)
        return;
    const { bunLockResult, packages, packagesMap } = readProject(projectDir);
    const duplicatesPackagesMap = selectPackages(filterDuplicatesPackagesMap(packagesMap), filter);
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(duplicatesPackagesMap));
    const identifedFixesMap = buildIdentifiedFixesMap(duplicatesPackagesMap, dependents);
    // as in `whyDuplicate`: a family is shown whole as soon as it holds a
    // selected member, because that is what explains the duplicate
    const clusterFixes = identifyClusterFixes(packagesMap, packages, bunLockResult.workspaces).filter((fix) => fix.members.some(filter.selects));
    displayMany({
        title: "duplicates",
        duplicatesPackagesMap,
        dependents,
        totalDependencies: Object.keys(packagesMap).length,
        identifiedFixesMap: identifedFixesMap,
        clusterFixes,
        details,
    });
}
// Reads bun.lock as it stands on disk and applies the pure-lock fixes to the
// parsed copy. In memory only: nothing reaches disk until `writeBunLockFile`,
// so this doubles as the dry-run probe.
const planLockRewrite = (projectDir, filterOptions) => {
    const filter = createPackageFilter(filterOptions);
    const { bunLockResult, packages, packagesMap } = readProject(projectDir);
    const duplicatesPackagesMap = selectPackages(filterDuplicatesPackagesMap(packagesMap), filter);
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(duplicatesPackagesMap));
    const lockResult = applyIdentifiedFixesToBunLock(bunLockResult, buildIdentifiedFixesMap(duplicatesPackagesMap, dependents));
    return {
        bunLockResult,
        lockResult,
        // read back from the rewritten copy, so the summary reports what the run
        // produced rather than what it aimed for
        versions: versionsSnapshotOf(parseBunLockPackages(bunLockResult)),
        residuals: lockResult.changed
            ? `bun.lock would be rewritten for ${lockResult.changedKeys.length} entrie(s): ${lockResult.changedKeys.join(", ")}`
            : undefined,
    };
};
// Cluster fixes go first: they are the only pass that can reach a version the
// lockfile does not carry, and the pure-lock pass then collapses the leaves bun
// did not merge on its own.
export function fixDuplicates({ mode = "apply", clusters = true, filter, } = {}) {
    const projectDir = resolveBunProjectDir();
    if (projectDir === null)
        return;
    const dryRun = mode !== "apply";
    // Read before the cluster pass touches anything: `bun install` rewrites the
    // lockfile, and the summary compares the whole run against this.
    const before = readVersionsSnapshot(lockPathOf(projectDir));
    // Only a dry run needs the residuals up front, to name them in the plan the
    // cluster pass prints. An apply plans the rewrite *after* the cluster pass,
    // against the lockfile `bun install` left behind.
    const probe = dryRun ? planLockRewrite(projectDir, filter) : null;
    const clusterOutcome = clusters
        ? applyClusterFixes({
            projectDir,
            dryRun,
            filter,
            packageManagerResiduals: probe?.residuals,
        })
        : null;
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
    const { bunLockResult, lockResult, versions } = planLockRewrite(projectDir, filter);
    if (lockResult.changed) {
        writeBunLockFile(bunLockResult, lockPathOf(projectDir));
    }
    // Both passes at once: the cluster pass already rewrote the lockfile through
    // `bun install`, and this copy carries the merges made on top of it.
    const deduped = diffVersionsSnapshots(before, versions);
    renderDedupeSummary({
        deduped,
        remainingDuplicates: countDuplicatedPackages(versions),
        whyCommand: "bun-why-duplicate",
    });
    if (lockResult.changed) {
        console.log("bun.lock updated");
        console.log("Please run `bun i` to apply the changes");
        console.log("If you want to format properly bun.lock again, you need to update a dependency", " eg (`bun update typescript && bun i`)");
    }
    else if (deduped.length === 0) {
        console.log("Nothing safe to dedupe identified");
    }
}
//# sourceMappingURL=index.js.map