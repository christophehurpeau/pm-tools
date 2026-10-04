import { stylePackageName } from "./packageStyles.ts";
import { createColorize, shouldColorize } from "./reportColors.ts";
import type { Colorize, ReportStyle } from "./reportColors.ts";
import { columnWidth, listText, padTo, plural } from "./reportText.ts";
import type { DedupedPackage } from "./versionsSnapshot.ts";

export interface DedupeSummaryOptions {
  deduped: DedupedPackage[];
  // packages the lockfile still resolves more than once, counted as
  // `why-duplicate` counts them so the two commands agree
  remainingDuplicates: number;
  whyCommand: string;
  color?: boolean;
  log?: (message?: string) => void;
}

// A package resolved more times than the shared cap is summarised: the line
// says what it collapsed to, not the whole census.
const versionList = (
  color: Colorize,
  versions: string[],
  style: ReportStyle,
): string =>
  `${plural(versions.length, "version", "versions")} (${listText({
    items: versions,
    render: (version) => color(style, version),
    more: (rest) => color("dim", `, +${rest} more`),
  })})`;

/**
 * What a dedupe run actually collapsed, one line per package. Shared by every
 * tool so the three of them report a run the same way; the caller still says
 * what it wrote, which only it knows.
 *
 * Both sides are counted and named: `2 versions (1.2.1, 1.3.0) -> 1 version
 * (1.2.1)` is the copy that went away, where a bare `1.3.0 -> 1.2.1` reads as a
 * downgrade the tool decided on its own.
 *
 * Nothing is printed when nothing was deduped: the caller has its own wording
 * for that, and an empty table reads as a failure it may not be.
 */
export const renderDedupeSummary = ({
  deduped,
  remainingDuplicates,
  whyCommand,
  color: colorEnabled = shouldColorize(),
  log = console.log,
}: DedupeSummaryOptions): void => {
  if (deduped.length === 0) return;

  const color = createColorize(colorEnabled);
  const mergedCount = deduped.reduce(
    (total, entry) => total + (entry.before.length - entry.after.length),
    0,
  );

  log(
    `${color("bold", "Deduped")} ${plural(deduped.length, "package", "packages")}, ${plural(mergedCount, "copy", "copies")} merged:`,
  );

  // tighter than the shared budget: two version lists follow the name here
  const width = columnWidth(
    deduped.map((entry) => entry.packageName),
    34,
  );

  for (const { packageName, before, after } of deduped) {
    log(
      `  ${stylePackageName(color, packageName)}:${padTo(width, packageName)} ${versionList(color, before, "yellow")} -> ${versionList(color, after, "green")}`,
    );
  }

  log(
    remainingDuplicates === 0
      ? "No duplicate left."
      : `${plural(remainingDuplicates, "duplicate", "duplicates")} left — run ${color("cyan", `\`${whyCommand}\``)} to see ${remainingDuplicates === 1 ? "it" : "them"}.`,
  );
};
