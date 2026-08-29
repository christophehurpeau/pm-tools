import {
  countDuplicatedPackages,
  createPackageFilter,
  diffVersionsSnapshots,
  renderDedupeSummary,
} from "pm-utils";
import type { PackageFilterOptions } from "pm-utils";
import { applyClusterFixes } from "./applyClusterFixes.ts";
import { lockPathOf, resolvePnpmProjectDir } from "./helpers/projectDir.ts";
import { runPnpm } from "./helpers/runPnpm.ts";
import { readVersionsSnapshot } from "./helpers/versionsSnapshot.ts";

// `--dry-run` and `--check` print the same plan and write nothing; only the exit
// code differs, so `--check` can gate CI while `--dry-run` stays informational.
export type DedupeMode = "apply" | "check" | "dry-run";

export interface DedupeOptions {
  mode?: DedupeMode;
  // false makes the cluster pass write plain overrides instead of convergence
  // ones, forcing every requester onto the version rather than only the ones
  // whose range accepts it
  convergenceOverrides?: boolean;
  // restricts which packages may be touched, for deduplicating a large lockfile
  // a family at a time
  filter?: PackageFilterOptions;
}

const residualsMessage = "`pnpm dedupe` would also change the lockfile.";

// `pnpm dedupe` merges everything it can and knows nothing of the filter, so
// running it would undo the point of a filtered run.
const filteredResidualsMessage =
  "`pnpm dedupe` was not run: it ignores the package filter. Run `pnpm dedupe` yourself, or this command without a filter, to finish the rest.";

/**
 * `pnpm dedupe` only merges what it can resolve to a single version on its own:
 * it never widens a workspace range, and it never repoints an edge that resolved
 * past a version the family already carries. Cluster fixes cover exactly that
 * gap, so they run first and `pnpm dedupe` finishes the residuals.
 */
export function dedupe({
  mode = "apply",
  convergenceOverrides = true,
  filter,
}: DedupeOptions = {}): void {
  const dryRun = mode !== "apply";
  const projectDir = resolvePnpmProjectDir();
  if (projectDir === null) return;
  const lockPath = lockPathOf(projectDir);
  const filtered = !createPackageFilter(filter).selectsEverything;

  // Read before anything runs: both the cluster pass and `pnpm dedupe` rewrite
  // the lockfile, and the summary compares the whole run against this.
  const before = readVersionsSnapshot(lockPath);

  // What the run merged, reported once the lockfile has settled — `pnpm dedupe`
  // included, since it is part of what this command does.
  const summarize = (): void => {
    const after = readVersionsSnapshot(lockPath);
    renderDedupeSummary({
      deduped: diffVersionsSnapshots(before, after),
      remainingDuplicates: countDuplicatedPackages(after),
      whyCommand: "pnpm-why-duplicate",
    });
  };

  // Read-only, so it can run before the cluster pass. It has to, for a dry run:
  // the plan report names the residuals, and only this knows about them. A
  // filtered run does not run `pnpm dedupe` at all, so what it would change is
  // not this command's business.
  const probe =
    dryRun && !filtered
      ? runPnpm(["dedupe", "--check"], { cwd: projectDir })
      : null;

  const residuals = ((): string | undefined => {
    if (filtered) return filteredResidualsMessage;
    if (probe !== null && probe.status !== 0) return residualsMessage;
    return undefined;
  })();

  const outcome = applyClusterFixes({
    projectDir,
    dryRun,
    convergenceOverrides,
    filter,
    packageManagerResiduals: residuals,
  });

  if (outcome.status === "kept-overrides") {
    console.log(
      `${outcome.stickyOverrides.length} override(s) left in pnpm-workspace.yaml — see the comment above them`,
    );
  }

  if (mode === "check") {
    process.exitCode =
      outcome.plannedChangeCount > 0 || (probe !== null && probe.status !== 0)
        ? 1
        : 0;
    return;
  }
  if (mode === "dry-run") return;

  if (filtered) {
    // Applying an override needs a real resolution, and `pnpm dedupe` is the
    // only one that performs it — so a filtered run that changed something has
    // already merged whatever else pnpm could reach on its own.
    if (outcome.status === "applied" || outcome.status === "kept-overrides") {
      console.log(
        "`pnpm dedupe` ran to apply the fixes above and merged what it could on its own: the filter bounds the edits made here, not pnpm's resolution.",
      );
    }
    console.log(filteredResidualsMessage);
    summarize();
    return;
  }

  const result = runPnpm(["dedupe"], { cwd: projectDir });
  if (result.status !== null) {
    process.exitCode = result.status;
  }
  summarize();
}
