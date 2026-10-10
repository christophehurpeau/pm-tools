import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  applyWorkspaceRangeEdit,
  captureFiles,
  createPackageFilter,
  describeSkippedClusterFix,
  diffDuplicates,
  heldOverrides,
  outstandingOverrides,
  partitionUnconditionalOverrides,
  planClusterApply,
  renderApplyPlan,
  restoreFiles,
  reuseKeys,
  selectClusterFixes,
  shouldColorize,
} from "pm-dedup-core";
import type {
  ApplyPlanFileChange,
  ClusterFix,
  DuplicateSnapshot,
  FileSnapshot,
  OverrideTargetState,
  PackageFilterOptions,
  PlannedManifestEdit,
  PlannedOverride,
  SelectedClusterFixes,
  VersionsSnapshot,
} from "pm-dedup-core";
import { buildPnpmPackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";
import { describeUnheldOverride } from "./helpers/describeUnheldOverride.ts";
import { readDuplicateSnapshot } from "./helpers/duplicateSnapshot.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
import {
  convergenceOverridesMinVersion,
  readPnpmVersion,
  supportsConvergenceOverrides,
} from "./helpers/pnpmVersion.ts";
import { addOverrides, overrideKey } from "./helpers/pnpmWorkspaceYaml.ts";
import { lockPathOf } from "./helpers/projectDir.ts";
import { createManifestReader } from "./helpers/readInstalledManifest.ts";
import { runPnpm } from "./helpers/runPnpm.ts";
import { readVersionsSnapshot } from "./helpers/versionsSnapshot.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import { readPnpmLock } from "./readPnpmLock.ts";

const issuesUrl = "https://github.com/christophehurpeau/pm-tools/issues";

export type ClusterApplyStatus =
  | "applied"
  | "dry-run"
  | "not-supported"
  | "nothing-to-do"
  | "reverted";

export interface ClusterApplyOutcome {
  status: ClusterApplyStatus;
  before: DuplicateSnapshot;
  after: DuplicateSnapshot;
  // overrides the result did not hold without: reported, never left behind
  stickyOverrides: PlannedOverride[];
  // how many edits the plan holds, so `--check` gates without re-planning
  plannedChangeCount: number;
}

export interface ApplyClusterFixesOptions {
  projectDir: string;
  dryRun?: boolean;
  log?: (message?: string) => void;
  // seams for tests: everything else runs against the real files
  resolve?: () => number | null;
  readFixes?: (projectDir: string) => ClusterFix[];
  readDuplicates?: (lockPath: string) => DuplicateSnapshot;
  readVersions?: (lockPath: string) => VersionsSnapshot;
  readDependentRanges?: (
    projectDir: string,
    packageNames: Set<string>,
  ) => DependentRangesMap;
  pnpmVersion?: () => string | null;
  // false writes plain overrides instead, which pnpm applies to every requester
  // whatever range it declares
  convergenceOverrides?: boolean;
  // restricts which packages may be touched, for deduplicating a large lockfile
  // a family at a time
  filter?: PackageFilterOptions;
  // what `pnpm dedupe` itself would still change, for the dry-run report. Only
  // the caller runs that probe, so only it can say.
  packageManagerResiduals?: string;
  // decided by the caller, because a caller that passes `log` is not writing to
  // `process.stdout` and cannot be read off it
  color?: boolean;
}

const defaultReadFixes = (projectDir: string): ClusterFix[] => {
  const lock = readPnpmLock(lockPathOf(projectDir));
  return identifyClusterFixes(
    lock,
    buildPnpmPackagesMap(parsePnpmLockPackages(lock)),
    createManifestReader(projectDir),
  );
};

const manifestPathOf = (projectDir: string, importerPath: string): string =>
  join(projectDir, importerPath === "." ? "" : importerPath, "package.json");

const describeOverride = (
  override: PlannedOverride,
  convergence: boolean,
): string =>
  `"${overrideKey(override.packageName, convergence)}": "${override.version}"`;

const defaultReadDependentRanges = (
  projectDir: string,
  packageNames: Set<string>,
): DependentRangesMap =>
  collectDependentRanges(
    readPnpmLock(lockPathOf(projectDir)),
    packageNames,
    createManifestReader(projectDir),
  );

// Each round only drops overrides, so this bounds a run that keeps losing one to
// a companion it held alongside.
const maxOverrideRounds = 3;

type ApplyState = OverrideTargetState;

interface DroppedOverride {
  override: PlannedOverride;
  // whether it held while the overrides were there, and only came apart once
  // pnpm resolved without them
  heldWithOverrides: boolean;
}

export const applyClusterFixes = ({
  projectDir,
  dryRun = false,
  log = console.log,
  // `pnpm dedupe`, not `pnpm install`: an override is applied by a read-package
  // hook that only runs during a real resolution, and an incremental install
  // reports "Already up to date" without ever re-reading a manifest. `dedupe`
  // re-resolves, and is also what runs right after this, so it is the only
  // honest thing to verify against.
  resolve = () => runPnpm(["dedupe"], { cwd: projectDir }).status,
  readFixes = defaultReadFixes,
  readDuplicates = readDuplicateSnapshot,
  readVersions = readVersionsSnapshot,
  readDependentRanges = defaultReadDependentRanges,
  pnpmVersion = () => readPnpmVersion(),
  convergenceOverrides = true,
  filter,
  packageManagerResiduals,
  color = shouldColorize(),
}: ApplyClusterFixesOptions): ClusterApplyOutcome => {
  const packageFilter = createPackageFilter(filter);
  const readSelectedFixes = (dir: string): SelectedClusterFixes =>
    selectClusterFixes(readFixes(dir), packageFilter);
  const lockPath = lockPathOf(projectDir);
  const workspaceYamlPath = join(projectDir, "pnpm-workspace.yaml");

  const before = readDuplicates(lockPath);
  const unchanged = (
    status: ClusterApplyStatus,
    plannedChangeCount = 0,
  ): ClusterApplyOutcome => ({
    status,
    before,
    after: before,
    stickyOverrides: [],
    plannedChangeCount,
  });

  const { selected: fixes, skipped: filteredOut } =
    readSelectedFixes(projectDir);
  // pnpm resolves an open range to the highest copy still in the tree, so a
  // reuse of the pinned version comes apart as soon as its override is removed.
  // The report still names those ranges; the plan does not chase them.
  const plan = planClusterApply(fixes, { reuse: false });

  const skipped = [
    ...filteredOut.map(describeSkippedClusterFix),
    ...plan.unresolvableChanges.map(
      (unresolvable) => `${unresolvable}: no workspace file recorded for it`,
    ),
    ...plan.conflicts.map(
      (conflict) =>
        `${conflict.packageName}: keeping ${conflict.kept}, ignoring ${conflict.dropped} asked by another cluster`,
    ),
  ];

  // a plain override applies to every requester of the package, so one a
  // third-party range rejects would force that dependent too
  const plannedOverrides = convergenceOverrides
    ? plan.overrides
    : (() => {
        const { safe, rejected } = partitionUnconditionalOverrides(
          fixes,
          plan.overrides,
        );
        for (const { override, rejectedBy } of rejected) {
          for (const constraint of rejectedBy) {
            skipped.push(
              `override ${describeOverride(override, false)}: ${constraint.requesterName ?? "workspace"} requires "${constraint.range}", and a plain override would force it too`,
            );
          }
        }
        return safe;
      })();

  const changeCount = plan.manifestEdits.length + plannedOverrides.length;

  const relativeManifestPath = (importerPath: string): string =>
    relative(projectDir, manifestPathOf(projectDir, importerPath));

  const planFileChanges = (): ApplyPlanFileChange[] => [
    ...[
      ...new Set(
        plan.manifestEdits.map((edit) =>
          relativeManifestPath(edit.importerPath),
        ),
      ),
    ].map((path) => ({
      path,
      changes: plan.manifestEdits
        .filter((edit) => relativeManifestPath(edit.importerPath) === path)
        .map(
          (edit) =>
            `"${edit.packageName}": "${edit.range}" -> "${edit.to}" (${edit.depType})`,
        ),
    })),
    {
      path: relative(projectDir, workspaceYamlPath),
      transient: "removed once the result is verified",
      changes: plannedOverrides.map(
        (override) =>
          `${describeOverride(override, convergenceOverrides)} (${override.reason})`,
      ),
    },
  ];

  // A dry run prints the plan through the shared renderer and stops. Anything
  // that rules the plan out has to be decided before that, or the report would
  // promise edits pnpm cannot make.
  const reportPlan = (applicable: boolean): ClusterApplyOutcome => {
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
      log(
        `Cluster fixes need pnpm >= ${convergenceOverridesMinVersion} (convergence overrides); found ${version ?? "no pnpm"}. Skipping them.`,
      );
      // nothing can be applied, so a `--check` run has nothing to fail on
      return dryRun ? reportPlan(false) : unchanged("not-supported");
    }
  }

  if (dryRun) {
    return reportPlan(true);
  }

  const touchedPaths = [
    ...new Set(
      plan.manifestEdits.map((edit) =>
        manifestPathOf(projectDir, edit.importerPath),
      ),
    ),
    workspaceYamlPath,
    lockPath,
  ];

  const originalSnapshot = captureFiles(touchedPaths);

  const revertTo = (snapshot: FileSnapshot[]): void => {
    restoreFiles(snapshot);
    resolve();
  };

  const editManifests = (edits: PlannedManifestEdit[]): boolean =>
    edits.every((edit) => {
      const path = manifestPathOf(projectDir, edit.importerPath);
      const updated = applyWorkspaceRangeEdit(readFileSync(path, "utf8"), edit);
      if (updated === undefined) {
        log(
          `  ${path} no longer declares "${edit.packageName}": "${edit.range}" — the lockfile is out of date`,
        );
        return false;
      }
      log(
        `  ${path}: "${edit.packageName}" ${edit.range} -> ${edit.to} in ${edit.depType}`,
      );
      writeFileSync(path, updated);
      return true;
    });

  // A reuse fix removes no duplicate — both copies keep their dependents — so
  // the duplicate set cannot tell whether it took. The detector can: the fix is
  // gone from its output once the edge points at the anchored version.
  const readState = (): ApplyState => ({
    duplicates: readDuplicates(lockPath),
    versions: readVersions(lockPath),
    reuses: reuseKeys(readSelectedFixes(projectDir).selected),
  });

  // A step keeps its edits as long as it broke nothing: a widened range often
  // deduplicates nothing on its own and only makes the overrides applicable.
  const resolveAndCheck = (label: string): ApplyState | null => {
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
  const workspaceYamlBefore = withoutOverridesSnapshot.find(
    (snapshot) => snapshot.path === workspaceYamlPath,
  )!;

  const remaining = readState();
  const outstanding = outstandingOverrides(plannedOverrides, remaining);

  const keptOutcome = (
    after: DuplicateSnapshot,
    stickyOverrides: PlannedOverride[],
  ): ClusterApplyOutcome => ({
    status: "applied",
    before,
    after,
    stickyOverrides,
    plannedChangeCount: changeCount,
  });

  if (outstanding.length === 0) {
    return keptOutcome(remaining.duplicates, []);
  }

  // The range edits already held on their own, so dropping the overrides keeps
  // them: only a run that made none of those has nothing left to show.
  const withoutOverrides = (
    stickyOverrides: PlannedOverride[],
  ): ClusterApplyOutcome => {
    revertTo(withoutOverridesSnapshot);
    return plan.manifestEdits.length > 0
      ? keptOutcome(readDuplicates(lockPath), stickyOverrides)
      : { ...unchanged("reverted", changeCount), stickyOverrides };
  };

  const heldIn = (
    overrides: PlannedOverride[],
    end: ApplyState,
  ): PlannedOverride[] => heldOverrides(overrides, { start: remaining, end });

  // Overrides are scaffolding: they are written, pnpm resolves with them, and
  // what counts is what is still there once they are removed again.
  const overrideRound = (
    overrides: PlannedOverride[],
  ): {
    heldWith: PlannedOverride[];
    heldAfter: PlannedOverride[];
    after: ApplyState;
  } | null => {
    log(
      `Adding ${convergenceOverrides ? "convergence" : "plain"} overrides to pnpm-workspace.yaml:`,
    );
    for (const override of overrides) {
      log(
        `  ${describeOverride(override, convergenceOverrides)} (${override.reason})`,
      );
    }
    writeFileSync(
      workspaceYamlPath,
      addOverrides(
        workspaceYamlBefore.content,
        new Map(
          overrides.map((override) => [override.packageName, override.version]),
        ),
        { convergence: convergenceOverrides },
      ),
    );

    const withOverrides = resolveAndCheck("the overrides");
    if (withOverrides === null) return null;
    const heldWith = heldIn(overrides, withOverrides);

    log("Removing the overrides and re-resolving to check the result holds:");
    restoreFiles([workspaceYamlBefore]);
    const after = resolveAndCheck("removing the overrides");
    if (after === null) return null;

    return { heldWith, heldAfter: heldIn(overrides, after), after };
  };

  // A member nothing duplicates only moves for its family's sake, so the
  // family's duplicated members already say what did not merge.
  const reportDropped = (dropped: DroppedOverride[]): void => {
    const reported = dropped.filter(({ override }) =>
      [...remaining.duplicates].some((resolution) =>
        resolution.startsWith(`${override.packageName}@`),
      ),
    );
    if (reported.length === 0) return;

    const ranges = readDependentRanges(
      projectDir,
      new Set(reported.map(({ override }) => override.packageName)),
    );
    const logGroup = (title: string, entries: DroppedOverride[]): void => {
      if (entries.length === 0) return;
      log(title);
      for (const { override } of entries) {
        log(`  ${override.packageName} onto ${override.version}:`);
        for (const line of describeUnheldOverride(
          override,
          ranges.get(override.packageName) ?? [],
        )) {
          log(`    ${line}`);
        }
      }
    };

    logGroup(
      "Not merged even with an override:",
      reported.filter((entry) => !entry.heldWithOverrides),
    );
    logGroup(
      "pnpm resolves these back without an override, so they are not merged:",
      reported.filter((entry) => entry.heldWithOverrides),
    );
    log(
      `No override is left behind. If one of these should merge, please report it at ${issuesUrl}`,
    );
  };

  const dropped: DroppedOverride[] = [];
  let candidates = outstanding;
  for (let round = 1; round <= maxOverrideRounds; round++) {
    if (round > 1) {
      log("Retrying with only the overrides that held:");
      restoreFiles(withoutOverridesSnapshot);
    }

    const result = overrideRound(candidates);
    if (result === null) return withoutOverrides([]);

    const { heldWith, heldAfter, after } = result;
    for (const override of candidates) {
      if (!heldAfter.includes(override)) {
        dropped.push({
          override,
          heldWithOverrides: heldWith.includes(override),
        });
      }
    }

    if (heldAfter.length === candidates.length) {
      reportDropped(dropped);
      return keptOutcome(
        after.duplicates,
        dropped.map(({ override }) => override),
      );
    }
    candidates = heldAfter;
    if (candidates.length === 0) break;
  }

  log(
    candidates.length === 0
      ? "  No override holds on its own — reverting them"
      : `  Overrides still came apart after ${maxOverrideRounds} rounds — reverting them`,
  );
  // what is left only held alongside overrides the last round dropped
  dropped.push(
    ...candidates.map((override) => ({ override, heldWithOverrides: true })),
  );
  const outcome = withoutOverrides(dropped.map(({ override }) => override));
  reportDropped(dropped);
  return outcome;
};
