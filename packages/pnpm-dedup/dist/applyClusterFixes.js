import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { applyWorkspaceRangeEdit, captureFiles, createPackageFilter, describeSkippedClusterFix, diffDuplicates, partitionUnconditionalOverrides, planClusterApply, renderApplyPlan, restoreFiles, selectClusterFixes, shouldColorize, } from "pm-utils";
import { buildPnpmPackagesMap } from "./helpers/buildPnpmPackagesMap.js";
import { readDuplicateSnapshot } from "./helpers/duplicateSnapshot.js";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.js";
import { convergenceOverridesMinVersion, readPnpmVersion, supportsConvergenceOverrides, } from "./helpers/pnpmVersion.js";
import { addOverrides, overrideKey } from "./helpers/pnpmWorkspaceYaml.js";
import { lockPathOf } from "./helpers/projectDir.js";
import { createManifestReader } from "./helpers/readInstalledManifest.js";
import { runPnpm } from "./helpers/runPnpm.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readPnpmLock } from "./readPnpmLock.js";
const issuesUrl = "https://github.com/christophehurpeau/pm-tools/issues";
const defaultReadFixes = (projectDir) => {
    const lock = readPnpmLock(lockPathOf(projectDir));
    return identifyClusterFixes(lock, buildPnpmPackagesMap(parsePnpmLockPackages(lock)), createManifestReader(projectDir));
};
const manifestPathOf = (projectDir, importerPath) => join(projectDir, importerPath === "." ? "" : importerPath, "package.json");
const describeOverride = (override, convergence) => `"${overrideKey(override.packageName, convergence)}": "${override.version}"`;
/**
 * Why the overrides below them had to stay. Used verbatim as the comment left in
 * `pnpm-workspace.yaml` and as the console explanation, so the file and the run
 * say the same thing. The packages are the entries that follow, so they are not
 * repeated here.
 */
const stickyOverrideReason = [
    "Added by pnpm-dedup.",
    "Removing these makes `pnpm dedupe` resolve them back to a duplicate, so they",
    "are what holds the deduplicated result. Keeping them is a workaround: no fix",
    "was found that survives on its own. Please report this cluster so it can be",
    `handled without a standing override: ${issuesUrl}`,
];
const reuseKeys = (fixes) => new Set(fixes.flatMap((fix) => fix.reuseFixes.map((reuse) => `${reuse.requesterName}>${reuse.packageName}@${reuse.to}`)));
export const applyClusterFixes = ({ projectDir, dryRun = false, log = console.log, 
// `pnpm dedupe`, not `pnpm install`: an override is applied by a read-package
// hook that only runs during a real resolution, and an incremental install
// reports "Already up to date" without ever re-reading a manifest. `dedupe`
// re-resolves, and is also what runs right after this, so it is the only
// honest thing to verify against.
resolve = () => runPnpm(["dedupe"], { cwd: projectDir }).status, readFixes = defaultReadFixes, readDuplicates = readDuplicateSnapshot, pnpmVersion = () => readPnpmVersion(), convergenceOverrides = true, filter, packageManagerResiduals, color = shouldColorize(), }) => {
    const packageFilter = createPackageFilter(filter);
    const readSelectedFixes = (dir) => selectClusterFixes(readFixes(dir), packageFilter);
    const lockPath = lockPathOf(projectDir);
    const workspaceYamlPath = join(projectDir, "pnpm-workspace.yaml");
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
    const skipped = [
        ...filteredOut.map(describeSkippedClusterFix),
        ...plan.unresolvableChanges.map((unresolvable) => `${unresolvable}: no workspace file recorded for it`),
        ...plan.conflicts.map((conflict) => `${conflict.packageName}: keeping ${conflict.kept}, ignoring ${conflict.dropped} asked by another cluster`),
    ];
    // a plain override applies to every requester of the package, so one a
    // third-party range rejects would force that dependent too
    const plannedOverrides = convergenceOverrides
        ? plan.overrides
        : (() => {
            const { safe, rejected } = partitionUnconditionalOverrides(fixes, plan.overrides);
            for (const { override, rejectedBy } of rejected) {
                for (const constraint of rejectedBy) {
                    skipped.push(`override ${describeOverride(override, false)}: ${constraint.requesterName ?? "workspace"} requires "${constraint.range}", and a plain override would force it too`);
                }
            }
            return safe;
        })();
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
            path: relative(projectDir, workspaceYamlPath),
            transient: "removed once the result is verified",
            changes: plannedOverrides.map((override) => `${describeOverride(override, convergenceOverrides)} (${override.reason})`),
        },
    ];
    // A dry run prints the plan through the shared renderer and stops. Anything
    // that rules the plan out has to be decided before that, or the report would
    // promise edits pnpm cannot make.
    const reportPlan = (applicable) => {
        renderApplyPlan({
            fileChanges: applicable ? planFileChanges() : [],
            skipped,
            packageManagerResiduals,
            dedupeCommand: "pnpm-dedupe",
            log,
            color,
        });
        return unchanged("dry-run", applicable ? changeCount : 0);
    };
    if (!dryRun) {
        for (const entry of skipped) {
            log(`  Skipped ${entry}`);
        }
    }
    if (changeCount === 0) {
        return dryRun ? reportPlan(false) : unchanged("nothing-to-do");
    }
    if (convergenceOverrides) {
        const version = pnpmVersion();
        if (version === null || !supportsConvergenceOverrides(version)) {
            log(`Cluster fixes need pnpm >= ${convergenceOverridesMinVersion} (convergence overrides); found ${version ?? "no pnpm"}. Skipping them.`);
            // nothing can be applied, so a `--check` run has nothing to fail on
            return dryRun ? reportPlan(false) : unchanged("not-supported");
        }
    }
    if (dryRun) {
        return reportPlan(true);
    }
    const touchedPaths = [
        ...new Set(plan.manifestEdits.map((edit) => manifestPathOf(projectDir, edit.importerPath))),
        workspaceYamlPath,
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
    // deduplicates nothing on its own and only makes the overrides applicable.
    const resolveAndCheck = (label) => {
        if (resolve() !== 0) {
            log(`  \`pnpm dedupe\` failed after ${label} — reverting`);
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
    const workspaceYamlBefore = withoutOverridesSnapshot.find((snapshot) => snapshot.path === workspaceYamlPath);
    const remaining = readState();
    // An override is still worth writing while its package is duplicated, or
    // while the edge it repoints is still resolving elsewhere.
    const outstanding = plannedOverrides.filter((override) => [...remaining.duplicates].some((resolution) => resolution.startsWith(`${override.packageName}@`)) ||
        [...remaining.reuses].some((key) => key.endsWith(`>${override.packageName}@${override.version}`)));
    if (outstanding.length === 0) {
        return {
            status: "applied",
            before,
            after: remaining.duplicates,
            stickyOverrides: [],
            plannedChangeCount: changeCount,
        };
    }
    log(`Adding ${convergenceOverrides ? "convergence" : "plain"} overrides to pnpm-workspace.yaml:`);
    for (const override of outstanding) {
        log(`  ${describeOverride(override, convergenceOverrides)} (${override.reason})`);
    }
    writeFileSync(workspaceYamlPath, addOverrides(workspaceYamlBefore.content, new Map(outstanding.map((override) => [override.packageName, override.version])), { convergence: convergenceOverrides }));
    const withOverrides = resolveAndCheck("the overrides");
    if (withOverrides === null) {
        revertTo(withoutOverridesSnapshot);
        return unchanged("reverted", changeCount);
    }
    // Overrides are scaffolding first: if pnpm holds the result without them they
    // are removed, and if it does not they go back with the reason recorded.
    log("Removing the overrides and re-resolving to check the result holds:");
    restoreFiles([workspaceYamlBefore]);
    if (resolve() !== 0) {
        log("  `pnpm dedupe` failed without the overrides — reverting");
        revertTo(withoutOverridesSnapshot);
        return unchanged("reverted", changeCount);
    }
    const after = readState();
    const returnedDuplicates = diffDuplicates(withOverrides.duplicates, after.duplicates).added;
    const returnedReuses = [...after.reuses].filter((key) => !withOverrides.reuses.has(key));
    if (returnedDuplicates.length > 0 || returnedReuses.length > 0) {
        writeFileSync(workspaceYamlPath, addOverrides(workspaceYamlBefore.content, new Map(outstanding.map((override) => [
            override.packageName,
            override.version,
        ])), {
            convergence: convergenceOverrides,
            comment: stickyOverrideReason.join("\n"),
        }));
        if (resolve() !== 0) {
            log("  `pnpm dedupe` failed with the overrides back — reverting");
            revertTo(withoutOverridesSnapshot);
            return unchanged("reverted", changeCount);
        }
        log(`  Kept in ${workspaceYamlPath}, with the same explanation as a comment:`);
        for (const override of outstanding) {
            log(`    ${describeOverride(override, convergenceOverrides)}`);
        }
        for (const line of stickyOverrideReason) {
            log(`  ${line}`);
        }
        return {
            status: "kept-overrides",
            before,
            after: readDuplicates(lockPath),
            stickyOverrides: outstanding,
            plannedChangeCount: changeCount,
        };
    }
    return {
        status: "applied",
        before,
        after: after.duplicates,
        stickyOverrides: [],
        plannedChangeCount: changeCount,
    };
};
//# sourceMappingURL=applyClusterFixes.js.map