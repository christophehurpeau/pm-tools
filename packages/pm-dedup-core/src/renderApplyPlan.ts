import { createColorize, shouldColorize } from "./reportColors.ts";
import { plural } from "./reportText.ts";

export interface ApplyPlanFileChange {
  // repo-relative
  path: string;
  // why the file is only touched for the duration of the run, when it is
  transient?: string;
  // one line per change, worded by the caller: only it knows the manifest
  // shape the change lands in
  changes: string[];
}

export interface ApplyPlanOptions {
  fileChanges: ApplyPlanFileChange[];
  // what the plan gave up on, and why
  skipped?: string[];
  // what the package manager's own dedupe would still do on top
  packageManagerResiduals?: string;
  dedupeCommand: string;
  color?: boolean;
  log?: (message?: string) => void;
}

export interface ApplyPlanSummary {
  changeCount: number;
}

/**
 * The plan a dedupe run would apply, shared by `--check` and `--dry-run`. The
 * returned `changeCount` is what `--check` gates its exit code on.
 */
export const renderApplyPlan = ({
  fileChanges,
  skipped = [],
  packageManagerResiduals,
  dedupeCommand,
  color: colorEnabled = shouldColorize(),
  log = console.log,
}: ApplyPlanOptions): ApplyPlanSummary => {
  const color = createColorize(colorEnabled);
  const changeCount = fileChanges.reduce(
    (total, file) => total + file.changes.length,
    0,
  );

  if (changeCount === 0 && packageManagerResiduals === undefined) {
    for (const entry of skipped) {
      log(`  - ${color("red", entry)}`);
    }
    log("Nothing to dedupe.");
    return { changeCount };
  }

  if (changeCount > 0) {
    log(color("dim", "Would apply:"));

    for (const file of fileChanges) {
      if (file.changes.length === 0) continue;
      const suffix =
        file.transient === undefined
          ? ""
          : color("dim", ` (transient, ${file.transient})`);
      log();
      log(`${color("bold", file.path)}${suffix}:`);
      for (const change of file.changes) {
        log(`  - ${change}`);
      }
    }
  }

  if (skipped.length > 0) {
    log();
    log(color("dim", "Skipped:"));
    for (const entry of skipped) {
      log(`  - ${color("red", entry)}`);
    }
  }

  if (packageManagerResiduals !== undefined) {
    log();
    log(packageManagerResiduals);
  }

  const touchedFiles = fileChanges.filter((file) => file.changes.length > 0);
  const counts =
    changeCount === 0
      ? ""
      : `${plural(changeCount, "change", "changes")} in ${plural(touchedFiles.length, "file", "files")}. `;

  log();
  log(`${counts}Run ${color("cyan", `\`${dedupeCommand}\``)} to apply.`);

  return { changeCount };
};
