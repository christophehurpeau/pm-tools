import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  applyWorkspaceRangeEdit,
  captureFiles,
  createPackageFilter,
  describeSkippedClusterFix,
  diffDuplicates,
  partitionUnconditionalOverrides,
  planClusterApply,
  renderApplyPlan,
  restoreFiles,
  selectClusterFixes,
  shouldColorize,
} from "pm-utils";
import type {
  ApplyPlanFileChange,
  ClusterFix,
  DuplicateSnapshot,
  FileSnapshot,
  PackageFilterOptions,
  PlannedManifestEdit,
  PlannedOverride,
  SelectedClusterFixes,
} from "pm-utils";
import { buildPackagesMap } from "./helpers/buildPackagesMap.ts";
import { readDuplicateSnapshot } from "./helpers/duplicateSnapshot.ts";
import { addOverrides } from "./helpers/packageJsonOverrides.ts";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
import { lockPathOf } from "./helpers/projectDir.ts";
import { runBun } from "./helpers/runBun.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import { readAndParseBunLock } from "./readAndParseBunLock.ts";

const issuesUrl = "https://github.com/christophehurpeau/pm-tools/issues";

export type ClusterApplyStatus =
  | "applied"
  | "dry-run"
  | "nothing-to-do"
  | "reverted";

export interface ClusterApplyOutcome {
  status: ClusterApplyStatus;
  before: DuplicateSnapshot;
  after: DuplicateSnapshot;
  // overrides the duplicates came back without: reported, never left behind
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
  verifyFrozen?: () => number | null;
  readFixes?: (projectDir: string) => ClusterFix[];
  readDuplicates?: (lockPath: string) => DuplicateSnapshot;
  // restricts which packages may be touched, for deduplicating a large lockfile
  // a family at a time
  filter?: PackageFilterOptions;
  // what `bun install` itself would still change, for the dry-run report. Only
  // the caller runs that probe, so only it can say.
  packageManagerResiduals?: string;
  // decided by the caller, because a caller that passes `log` is not writing to
  // `process.stdout` and cannot be read off it
  color?: boolean;
}

const defaultReadFixes = (projectDir: string): ClusterFix[] => {
  const lock = readAndParseBunLock(lockPathOf(projectDir));
  const packages = parseBunLockPackages(lock);
  return identifyClusterFixes(
    buildPackagesMap(packages),
    packages,
    lock.workspaces,
  );
};

// bun keys the workspace root as "", which `join` already treats as the
// project directory itself
const manifestPathOf = (projectDir: string, importerPath: string): string =>
  join(projectDir, importerPath, "package.json");

const describeOverride = (override: PlannedOverride): string =>
  `"${override.packageName}": "${override.version}"`;

/**
 * A bun override never repoints an edge declared through an npm alias
 * (`"psc-pinned": "npm:printable-shell-command@~5.0.0"`) — measured against bun
 * 1.3, keying the override by the alias or by the real name alike. The override
 * is still written, because an in-cluster requester declaring the package
 * directly is repointed by it, but a package no direct edge reaches cannot
 * converge this way and the revert that follows would otherwise say nothing.
 */
const aliasOnlyRequesters = (
  fixes: ClusterFix[],
  packageName: string,
): string[] => {
  const constraints = fixes
    .flatMap((fix) => fix.externalConstraints)
    .filter((constraint) => constraint.packageName === packageName);

  return constraints.length > 0 && constraints.every((c) => c.isAlias === true)
    ? constraints.map((constraint) => constraint.requester)
    : [];
};

interface ApplyState {
  duplicates: DuplicateSnapshot;
  // one key per open range still resolving away from the version the workspace
  // anchors its family at
  reuses: Set<string>;
}

const reuseKeys = (fixes: ClusterFix[]): Set<string> =>
  new Set(
    fixes.flatMap((fix) =>
      fix.reuseFixes.map(
        (reuse) => `${reuse.requesterName}>${reuse.packageName}@${reuse.to}`,
      ),
    ),
  );

export const applyClusterFixes = ({
  projectDir,
  dryRun = false,
  log = console.log,
  // `bun install` is the only way to reach a version whose manifest the lockfile
  // does not carry, and the only thing that cascades a family's internal pins.
  resolve = () => runBun(["install"], { cwd: projectDir }).status,
  // the result has to be what CI would install from the manifests alone
  verifyFrozen = () =>
    runBun(["install", "--frozen-lockfile"], { cwd: projectDir }).status,
  readFixes = defaultReadFixes,
  readDuplicates = readDuplicateSnapshot,
  filter,
  packageManagerResiduals,
  color = shouldColorize(),
}: ApplyClusterFixesOptions): ClusterApplyOutcome => {
  const packageFilter = createPackageFilter(filter);
  const readSelectedFixes = (dir: string): SelectedClusterFixes =>
    selectClusterFixes(readFixes(dir), packageFilter);

  const lockPath = lockPathOf(projectDir);
  const rootManifestPath = join(projectDir, "package.json");

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
  const plan = planClusterApply(fixes);

  // a bun override applies to every requester of the package, so one a
  // third-party range rejects would force that dependent too
  const { safe: plannedOverrides, rejected } = partitionUnconditionalOverrides(
    fixes,
    plan.overrides,
  );

  const skipped = [
    ...filteredOut.map(describeSkippedClusterFix),
    ...plan.unresolvableChanges.map(
      (unresolvable) => `${unresolvable}: no workspace file recorded for it`,
    ),
    ...plan.conflicts.map(
      (conflict) =>
        `${conflict.packageName}: keeping ${conflict.kept}, ignoring ${conflict.dropped} asked by another cluster`,
    ),
    ...rejected.flatMap(({ override, rejectedBy }) =>
      rejectedBy.map(
        (constraint) =>
          `override ${describeOverride(override)}: ${constraint.requesterName ?? "workspace"} requires "${constraint.range}", and a bun override would force it too`,
      ),
    ),
  ];

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
      path: `${relative(projectDir, rootManifestPath)} overrides`,
      transient: "removed once the result is verified",
      changes: plannedOverrides.map(
        (override) => `${describeOverride(override)} (${override.reason})`,
      ),
    },
  ];

  // A dry run prints the plan through the shared renderer and stops.
  const reportPlan = (): ClusterApplyOutcome => {
    renderApplyPlan({
      fileChanges: changeCount === 0 ? [] : planFileChanges(),
      skipped,
      packageManagerResiduals,
      dedupeCommand: "bun-dedupe",
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
      ...plan.manifestEdits.map((edit) =>
        manifestPathOf(projectDir, edit.importerPath),
      ),
      rootManifestPath,
    ]),
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
    reuses: reuseKeys(readSelectedFixes(projectDir).selected),
  });

  // A step keeps its edits as long as it broke nothing: a widened range often
  // deduplicates nothing on its own and only makes the overrides applicable.
  const resolveAndCheck = (label: string): ApplyState | null => {
    if (resolve() !== 0) {
      log(`  \`bun install\` failed after ${label} — reverting`);
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
  const rootManifestBefore = withoutOverridesSnapshot.find(
    (snapshot) => snapshot.path === rootManifestPath,
  )!;

  const remaining = readState();
  // An override is still worth writing while its package is duplicated, or
  // while the edge it repoints is still resolving elsewhere.
  const outstanding = plannedOverrides.filter(
    (override) =>
      [...remaining.duplicates].some((resolution) =>
        resolution.startsWith(`${override.packageName}@`),
      ) ||
      [...remaining.reuses].some((key) =>
        key.endsWith(`>${override.packageName}@${override.version}`),
      ),
  );

  // The result is only a fix if CI can install it from the manifests as they
  // stand, overrides removed and all.
  const frozenFailure = (): ClusterApplyOutcome | null => {
    if (verifyFrozen() === 0) return null;
    log(
      "  `bun install --frozen-lockfile` rejects the result — reverting, the lockfile it produced is not one CI can reuse",
    );
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
    return (
      frozenFailure() ?? {
        status: "applied",
        before,
        after: remaining.duplicates,
        stickyOverrides: [],
        plannedChangeCount: changeCount,
      }
    );
  }

  log(`Adding overrides to ${rootManifestPath}:`);
  for (const override of outstanding) {
    log(`  ${describeOverride(override)} (${override.reason})`);
    const aliased = aliasOnlyRequesters(fixes, override.packageName);
    if (aliased.length > 0) {
      log(
        `    every requester of ${override.packageName} declares it through an alias (${aliased.join(", ")}); a bun override does not reach those edges`,
      );
    }
  }
  writeFileSync(
    rootManifestPath,
    addOverrides(
      rootManifestBefore.content ?? "{}",
      new Map(
        outstanding.map((override) => [override.packageName, override.version]),
      ),
    ),
  );

  const withOverrides = resolveAndCheck("the overrides");
  if (withOverrides === null) {
    revertTo(withoutOverridesSnapshot);
    return unchanged("reverted", changeCount);
  }

  // The overrides are scaffolding: bun has to hold the deduplicated result on
  // its own, or the fix is not one we can ship.
  log("Removing the overrides and re-resolving to check the result holds:");
  restoreFiles([rootManifestBefore]);

  if (resolve() !== 0) {
    log("  `bun install` failed without the overrides — reverting");
    revertTo(withoutOverridesSnapshot);
    return unchanged("reverted", changeCount);
  }

  const after = readState();
  const returnedDuplicates = diffDuplicates(
    withOverrides.duplicates,
    after.duplicates,
  ).added;
  const returnedReuses = [...after.reuses].filter(
    (key) => !withOverrides.reuses.has(key),
  );

  if (returnedDuplicates.length > 0 || returnedReuses.length > 0) {
    log(
      "  The overrides were the only thing holding the result: bun resolves back without them. A fix that needs a standing override is not one this tool applies.",
    );
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

  return (
    frozenFailure() ?? {
      status: "applied",
      before,
      after: after.duplicates,
      stickyOverrides: [],
      plannedChangeCount: changeCount,
    }
  );
};
