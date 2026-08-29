import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { applyWorkspaceRangeEdit, captureFiles, createPackageFilter, describeSkippedClusterFix, diffDuplicates, partitionUnconditionalOverrides, planClusterApply, renderApplyPlan, restoreFiles, selectClusterFixes, shouldColorize, } from "pm-utils";
import { buildYarnPackagesMap } from "./helpers/buildYarnPackagesMap.js";
import { collectWorkspaces, createManifestReader, } from "./helpers/collectWorkspaces.js";
import { readDuplicateSnapshot } from "./helpers/duplicateSnapshot.js";
import { addResolutions } from "./helpers/packageJsonResolutions.js";
import { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.js";
import { lockPathOf } from "./helpers/projectDir.js";
import { runYarn } from "./helpers/runYarn.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readAndParseYarnLock } from "./readYarnLock.js";
const issuesUrl = "https://github.com/christophehurpeau/pm-tools/issues";
const defaultReadFixes = (projectDir) => {
    const entries = readAndParseYarnLock(lockPathOf(projectDir));
    const packages = parseYarnLockPackages(entries);
    return identifyClusterFixes(buildYarnPackagesMap(packages), packages, collectWorkspaces(packages, createManifestReader(projectDir)));
};
// the root workspace is keyed "", which `join` already treats as the project
// directory itself
const manifestPathOf = (projectDir, importerPath) => join(projectDir, importerPath, "package.json");
const describeOverride = (override) => `"${override.packageName}": "${override.version}"`;
/**
 * A yarn resolution is matched against the package a descriptor resolves to, so
 * an edge declared through an npm alias
 * (`"psc-pinned": "npm:printable-shell-command@~5.0.0"`) is repointed by a
 * resolution on the *target* name. The resolution is still written, because an
 * in-cluster requester declaring the package directly is repointed by it too,
 * but naming the alias-only requesters keeps a revert from saying nothing.
 */
const aliasOnlyRequesters = (fixes, packageName) => {
    const constraints = fixes
        .flatMap((fix) => fix.externalConstraints)
        .filter((constraint) => constraint.packageName === packageName);
    return constraints.length > 0 && constraints.every((c) => c.isAlias === true)
        ? constraints.map((constraint) => constraint.requester)
        : [];
};
const reuseKeys = (fixes) => new Set(fixes.flatMap((fix) => fix.reuseFixes.map((reuse) => `${reuse.requesterName}>${reuse.packageName}@${reuse.to}`)));
export const applyClusterFixes = ({ projectDir, dryRun = false, log = console.log, 
// `yarn install` is the only way to reach a version whose manifest the
// lockfile does not carry, and the only thing that cascades a family's
// internal pins
resolve = () => runYarn(["install"], { cwd: projectDir }).status, 
// the result has to be what CI would install from the manifests alone
verifyFrozen = () => runYarn(["install", "--immutable"], { cwd: projectDir }).status, readFixes = defaultReadFixes, readDuplicates = readDuplicateSnapshot, filter, packageManagerResiduals, color = shouldColorize(), }) => {
    const packageFilter = createPackageFilter(filter);
    const readSelectedFixes = (dir) => selectClusterFixes(readFixes(dir), packageFilter);
    const lockPath = lockPathOf(projectDir);
    const rootManifestPath = join(projectDir, "package.json");
    const before = readDuplicates(lockPath);
    const unchanged = (status, plannedChangeCount = 0) => ({
        status,
        before,
        after: before,
        stickyOverrides: [],
        plannedChangeCount,
    });
    const { selected: fixes, skipped: filteredOut } = readSelectedFixes(projectDir);
    const plan = planClusterApply(fixes);
    // a yarn resolution applies to every requester of the package, so one a
    // third-party range rejects would force that dependent too
    const { safe: plannedOverrides, rejected } = partitionUnconditionalOverrides(fixes, plan.overrides);
    const skipped = [
        ...filteredOut.map(describeSkippedClusterFix),
        ...plan.unresolvableChanges.map((unresolvable) => `${unresolvable}: no workspace file recorded for it`),
        ...plan.conflicts.map((conflict) => `${conflict.packageName}: keeping ${conflict.kept}, ignoring ${conflict.dropped} asked by another cluster`),
        ...rejected.flatMap(({ override, rejectedBy }) => rejectedBy.map((constraint) => `resolution ${describeOverride(override)}: ${constraint.requesterName ?? "workspace"} requires "${constraint.range}", and a yarn resolution would force it too`)),
    ];
    const changeCount = plan.manifestEdits.length + plannedOverrides.length;
    const relativeManifestPath = (importerPath) => relative(projectDir, manifestPathOf(projectDir, importerPath));
    const planFileChanges = () => [
        ...[
            ...new Set(plan.manifestEdits.map((edit) => relativeManifestPath(edit.importerPath))),
        ].map((path) => ({
            path,
            changes: plan.manifestEdits
                .filter((edit) => relativeManifestPath(edit.importerPath) === path)
                .map((edit) => `"${edit.packageName}": "${edit.range}" -> "${edit.to}" (${edit.depType})`),
        })),
        {
            path: `${relative(projectDir, rootManifestPath)} resolutions`,
            transient: "removed once the result is verified",
            changes: plannedOverrides.map((override) => `${describeOverride(override)} (${override.reason})`),
        },
    ];
    // A dry run prints the plan through the shared renderer and stops.
    const reportPlan = () => {
        renderApplyPlan({
            fileChanges: changeCount === 0 ? [] : planFileChanges(),
            skipped,
            packageManagerResiduals,
            dedupeCommand: "yarn-berry-deduplicate",
            log,
            color,
        });
        return unchanged("dry-run", changeCount);
    };
    if (!dryRun) {
        for (const entry of skipped) {
            log(`  Skipped ${entry}`);
        }
    }
    if (changeCount === 0) {
        return dryRun ? reportPlan() : unchanged("nothing-to-do");
    }
    if (dryRun) {
        return reportPlan();
    }
    const touchedPaths = [
        ...new Set([
            ...plan.manifestEdits.map((edit) => manifestPathOf(projectDir, edit.importerPath)),
            rootManifestPath,
        ]),
        lockPath,
    ];
    const originalSnapshot = captureFiles(touchedPaths);
    const revertTo = (snapshot) => {
        restoreFiles(snapshot);
        resolve();
    };
    const editManifests = (edits) => edits.every((edit) => {
        const path = manifestPathOf(projectDir, edit.importerPath);
        const updated = applyWorkspaceRangeEdit(readFileSync(path, "utf8"), edit);
        if (updated === undefined) {
            log(`  ${path} no longer declares "${edit.packageName}": "${edit.range}" — the lockfile is out of date`);
            return false;
        }
        log(`  ${path}: "${edit.packageName}" ${edit.range} -> ${edit.to} in ${edit.depType}`);
        writeFileSync(path, updated);
        return true;
    });
    // A reuse fix removes no duplicate — both copies keep their dependents — so
    // the duplicate set cannot tell whether it took. The detector can: the fix is
    // gone from its output once the edge points at the anchored version.
    const readState = () => ({
        duplicates: readDuplicates(lockPath),
        reuses: reuseKeys(readSelectedFixes(projectDir).selected),
    });
    // A step keeps its edits as long as it broke nothing: a widened range often
    // deduplicates nothing on its own and only makes the resolutions applicable.
    const resolveAndCheck = (label) => {
        if (resolve() !== 0) {
            log(`  \`yarn install\` failed after ${label} — reverting`);
            return null;
        }
        const state = readState();
        const { added } = diffDuplicates(before, state.duplicates);
        if (added.length > 0) {
            log(`  ${label} introduced ${added.length} new duplicate(s) — reverting`);
            return null;
        }
        return state;
    };
    if (plan.manifestEdits.length > 0) {
        log("Editing workspace ranges:");
        if (!editManifests(plan.manifestEdits)) {
            revertTo(originalSnapshot);
            return unchanged("reverted", changeCount);
        }
        if (resolveAndCheck("the workspace range edits") === null) {
            revertTo(originalSnapshot);
            return unchanged("reverted", changeCount);
        }
    }
    const withoutOverridesSnapshot = captureFiles(touchedPaths);
    const rootManifestBefore = withoutOverridesSnapshot.find((snapshot) => snapshot.path === rootManifestPath);
    const remaining = readState();
    // A resolution is still worth writing while its package is duplicated, or
    // while the edge it repoints is still resolving elsewhere.
    const outstanding = plannedOverrides.filter((override) => [...remaining.duplicates].some((resolution) => resolution.startsWith(`${override.packageName}@`)) ||
        [...remaining.reuses].some((key) => key.endsWith(`>${override.packageName}@${override.version}`)));
    // The result is only a fix if CI can install it from the manifests as they
    // stand, resolutions removed and all.
    const frozenFailure = () => {
        if (verifyFrozen() === 0)
            return null;
        log("  `yarn install --immutable` rejects the result — reverting, the lockfile it produced is not one CI can reuse");
        revertTo(withoutOverridesSnapshot);
        return {
            status: "reverted",
            before,
            after: readDuplicates(lockPath),
            stickyOverrides: [],
            plannedChangeCount: changeCount,
        };
    };
    if (outstanding.length === 0) {
        return (frozenFailure() ?? {
            status: "applied",
            before,
            after: remaining.duplicates,
            stickyOverrides: [],
            plannedChangeCount: changeCount,
        });
    }
    log(`Adding resolutions to ${rootManifestPath}:`);
    for (const override of outstanding) {
        log(`  ${describeOverride(override)} (${override.reason})`);
        const aliased = aliasOnlyRequesters(fixes, override.packageName);
        if (aliased.length > 0) {
            log(`    every requester of ${override.packageName} declares it through an alias (${aliased.join(", ")}); a yarn resolution repoints the target, not those keys`);
        }
    }
    writeFileSync(rootManifestPath, addResolutions(rootManifestBefore.content ?? "{}", new Map(outstanding.map((override) => [override.packageName, override.version]))));
    const withOverrides = resolveAndCheck("the resolutions");
    if (withOverrides === null) {
        revertTo(withoutOverridesSnapshot);
        return unchanged("reverted", changeCount);
    }
    // The resolutions are scaffolding: yarn has to hold the deduplicated result
    // on its own, or the fix is not one we can ship.
    log("Removing the resolutions and re-resolving to check the result holds:");
    restoreFiles([rootManifestBefore]);
    if (resolve() !== 0) {
        log("  `yarn install` failed without the resolutions — reverting");
        revertTo(withoutOverridesSnapshot);
        return unchanged("reverted", changeCount);
    }
    const after = readState();
    const returnedDuplicates = diffDuplicates(withOverrides.duplicates, after.duplicates).added;
    const returnedReuses = [...after.reuses].filter((key) => !withOverrides.reuses.has(key));
    if (returnedDuplicates.length > 0 || returnedReuses.length > 0) {
        log("  The resolutions were the only thing holding the result: yarn resolves back without them. A fix that needs a standing resolution is not one this tool applies.");
        log(`  Please report this cluster at ${issuesUrl}:`);
        for (const override of outstanding) {
            log(`    ${describeOverride(override)}`);
        }
        revertTo(withoutOverridesSnapshot);
        return {
            status: "reverted",
            before,
            after: readDuplicates(lockPath),
            stickyOverrides: outstanding,
            plannedChangeCount: changeCount,
        };
    }
    return (frozenFailure() ?? {
        status: "applied",
        before,
        after: after.duplicates,
        stickyOverrides: [],
        plannedChangeCount: changeCount,
    });
};
//# sourceMappingURL=applyClusterFixes.js.map