import { buildIdentifiedFixesMap, countDuplicatedPackages, createPackageFilter, diffVersionsSnapshots, renderApplyPlan, renderDedupeSummary, selectExplainedPackages, selectPackages, } from "pm-utils";
import { applyClusterFixes } from "./applyClusterFixes.js";
import { displayMany } from "./displayMany.js";
import { applyIdentifiedFixesToYarnLock } from "./helpers/applyIdentifiedFixesToYarnLock.js";
import { buildYarnPackagesMap, filterDuplicatesYarnPackagesMap, } from "./helpers/buildYarnPackagesMap.js";
import { collectWorkspaces, createManifestReader, } from "./helpers/collectWorkspaces.js";
import { collectYarnDependents } from "./helpers/collectYarnDependents.js";
import { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.js";
import { lockPathOf, resolveYarnProjectDir } from "./helpers/projectDir.js";
import { readVersionsSnapshot, versionsSnapshotOf, } from "./helpers/versionsSnapshot.js";
import { writeYarnLockFile } from "./helpers/writeYarnLockFile.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readAndParseYarnLock } from "./readYarnLock.js";
export { displayMany } from "./displayMany.js";
export { applyClusterFixes } from "./applyClusterFixes.js";
export { identifyClusterFixes } from "./identifyClusterFixes.js";
export { readAndParseYarnLock } from "./readYarnLock.js";
export { parseYarnLock, stringifyYarnLock } from "./helpers/syml.js";
export { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.js";
export { buildYarnPackagesMap, filterDuplicatesYarnPackagesMap, } from "./helpers/buildYarnPackagesMap.js";
export { collectWorkspaces, createManifestReader, } from "./helpers/collectWorkspaces.js";
export { collectYarnDependents } from "./helpers/collectYarnDependents.js";
export { toLockstepGraph } from "./helpers/toLockstepGraph.js";
export { readVersionsSnapshot, versionsSnapshotOf, } from "./helpers/versionsSnapshot.js";
export { applyIdentifiedFixesToYarnLock } from "./helpers/applyIdentifiedFixesToYarnLock.js";
export { writeYarnLockFile } from "./helpers/writeYarnLockFile.js";
export { identifyResolutionFixes } from "pm-utils";
const readProject = (projectDir) => {
    const entries = readAndParseYarnLock(lockPathOf(projectDir));
    const packages = parseYarnLockPackages(entries);
    return {
        entries,
        packages,
        packagesMap: buildYarnPackagesMap(packages),
        workspaces: collectWorkspaces(packages, createManifestReader(projectDir)),
    };
};
export function whyDuplicate({ filter: filterOptions, all = false, details = false, }) {
    const filter = createPackageFilter(filterOptions);
    const projectDir = resolveYarnProjectDir();
    if (projectDir === null)
        return;
    const { packages, packagesMap, workspaces } = readProject(projectDir);
    const { packages: filteredPackages, title, notice, } = selectExplainedPackages({ packagesMap, filter, all });
    const dependents = collectYarnDependents({
        packages,
        workspaces,
        onlyPackageNames: Object.keys(filteredPackages),
    });
    // A duplicate is often only explainable by its family: show the cluster fixes
    // covering the matched packages, not just their own dependents.
    const matchedClusterFixes = identifyClusterFixes(packagesMap, packages, workspaces).filter((fix) => fix.members.some(filter.selects));
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
    const projectDir = resolveYarnProjectDir();
    if (projectDir === null)
        return;
    const { packages, packagesMap, workspaces } = readProject(projectDir);
    const duplicatesPackagesMap = selectPackages(filterDuplicatesYarnPackagesMap(packagesMap), filter);
    const dependents = collectYarnDependents({
        packages,
        workspaces,
        onlyPackageNames: Object.keys(duplicatesPackagesMap),
    });
    displayMany({
        title: "duplicates",
        duplicatesPackagesMap,
        dependents,
        totalDependencies: Object.keys(packagesMap).length,
        identifiedFixesMap: buildIdentifiedFixesMap(duplicatesPackagesMap, dependents),
        // as in `whyDuplicate`: a family is shown whole as soon as it holds a
        // selected member, because that is what explains the duplicate
        clusterFixes: identifyClusterFixes(packagesMap, packages, workspaces).filter((fix) => fix.members.some(filter.selects)),
        details,
    });
}
/**
 * Reads yarn.lock as it stands on disk and applies the pure-lock fixes to the
 * parsed copy. In memory only: nothing reaches disk until `writeYarnLockFile`,
 * so this doubles as the dry-run probe.
 */
const planLockRewrite = (projectDir, filterOptions) => {
    const filter = createPackageFilter(filterOptions);
    const { entries, packages, packagesMap, workspaces } = readProject(projectDir);
    const duplicatesPackagesMap = selectPackages(filterDuplicatesYarnPackagesMap(packagesMap), filter);
    const dependents = collectYarnDependents({
        packages,
        workspaces,
        onlyPackageNames: Object.keys(duplicatesPackagesMap),
    });
    const rewrite = applyIdentifiedFixesToYarnLock(entries, buildIdentifiedFixesMap(duplicatesPackagesMap, dependents));
    return {
        ...rewrite,
        // read back from the rewritten copy, so the summary reports what the run
        // produced rather than what it aimed for
        versions: versionsSnapshotOf(parseYarnLockPackages(rewrite.entries)),
        residuals: rewrite.result.changed
            ? `yarn.lock would be rewritten for ${rewrite.result.changedKeys.length} entrie(s): ${rewrite.result.changedKeys.join(", ")}`
            : undefined,
    };
};
// Cluster fixes go first: they are the only pass that can reach a version the
// lockfile does not carry, and the pure-lock pass then collapses the leaves
// yarn did not merge on its own.
export function fixDuplicates({ mode = "apply", clusters = true, filter, } = {}) {
    const projectDir = resolveYarnProjectDir();
    if (projectDir === null)
        return;
    const dryRun = mode !== "apply";
    // Read before the cluster pass touches anything: `yarn install` rewrites the
    // lockfile, and the summary compares the whole run against this.
    const before = readVersionsSnapshot(lockPathOf(projectDir));
    // Only a dry run needs the residuals up front, to name them in the plan the
    // cluster pass prints. An apply plans the rewrite *after* the cluster pass,
    // against the lockfile `yarn install` left behind.
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
                dedupeCommand: "yarn-berry-deduplicate",
            });
        }
        if (mode === "check") {
            process.exitCode =
                (clusterOutcome?.plannedChangeCount ?? 0) > 0 ||
                    (probe?.result.changed ?? false)
                    ? 1
                    : 0;
        }
        return;
    }
    // The cluster pass runs `yarn install`, which rewrites yarn.lock on disk — so
    // the pure-lock pass has to plan against the file as it stands now. Planning
    // it earlier and writing that copy back would clobber the cluster result.
    const { entries, result, versions } = planLockRewrite(projectDir, filter);
    if (result.changed) {
        writeYarnLockFile(entries, lockPathOf(projectDir));
    }
    // Both passes at once: the cluster pass already rewrote the lockfile through
    // `yarn install`, and this copy carries the merges made on top of it.
    const deduped = diffVersionsSnapshots(before, versions);
    renderDedupeSummary({
        deduped,
        remainingDuplicates: countDuplicatedPackages(versions),
        whyCommand: "yarn-berry-why-duplicate",
    });
    if (result.changed) {
        console.log("yarn.lock updated");
        console.log("Please run `yarn install` to apply the changes");
    }
    else if (deduped.length === 0) {
        console.log("Nothing safe to dedupe identified");
    }
}
//# sourceMappingURL=index.js.map