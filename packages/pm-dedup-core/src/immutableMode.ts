import { createColorize, shouldColorize } from "./reportColors.ts";

// `--dry-run` and `--check` print the same plan and write nothing; only the exit
// code differs, so `--check` can gate CI while `--dry-run` stays informational.
export type DedupeMode = "apply" | "check" | "dry-run";

export interface ResolveImmutableModeOptions {
  requested: DedupeMode;
  // only asked for an apply: it can spawn the package manager
  isImmutable: () => boolean;
  // opens the notice, e.g. "yarn installs are immutable here (enableImmutableInstalls, on by default on CI)"
  reason: string;
  immutableDryRun: boolean;
  log?: (message?: string) => void;
  color?: boolean;
}

/**
 * Where the package manager would not write the lockfile on install, neither
 * does an apply: the outer install already settled it, nothing a CI checkout is
 * left with gets committed, and the cluster pass could not run its own
 * installs. The run becomes a `--check`, or a `--dry-run` with
 * `--immutable-dry-run`, and says so before anything else.
 */
export const resolveImmutableMode = ({
  requested,
  isImmutable,
  reason,
  immutableDryRun,
  log = console.log,
  color = shouldColorize(),
}: ResolveImmutableModeOptions): DedupeMode => {
  if (requested !== "apply" || !isImmutable()) return requested;

  const colorize = createColorize(color);
  const mode = immutableDryRun ? "dry-run" : "check";
  log(
    colorize(
      ["bold", "yellow"],
      `${reason}: running as --${mode}, nothing is written.`,
    ),
  );
  if (!immutableDryRun) {
    log(
      "Pass --immutable-dry-run to report the plan without failing; run it where installs are writable to apply it.",
    );
  }
  log();
  return mode;
};
