import { clusterLabel } from "./clusterLabel.ts";
import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
import { createColorize, shouldColorize } from "./reportColors.ts";
import type { Colorize } from "./reportColors.ts";

export interface DuplicateResolutionView {
  resolution: string;
  installations: string[];
}

export interface DuplicateDependentView {
  requester: string;
  range: string;
  // version this requester actually got, when it is known and differs from the
  // range. A lockfile that only stores resolved versions makes the two look
  // identical, which is exactly the confusion this spells out.
  resolvedVersion?: string;
}

// How a duplicate would collapse: the resolutions that go away, and the one
// they merge into.
export interface DuplicateDedupeView {
  from: string[];
  to: string;
  // spelled out when the target is not the highest of them: a downgrade is a
  // decision, not a detail
  direction?: ClusterFix["direction"];
}

export interface DuplicatePackageView {
  packageName: string;
  resolutions: DuplicateResolutionView[];
  dependents: DuplicateDependentView[];
  dedupe: DuplicateDedupeView[];
}

export interface DuplicatesReportOptions {
  title: "duplicates" | "matches";
  packages: DuplicatePackageView[];
  // every package in the lockfile, not just the ones listed here
  totalDependencies: number;
  clusterFixes?: ClusterFix[];
  dedupeCommand: string;
  color?: boolean;
  log?: (message?: string) => void;
}

const clusterExplanation = [
  "A lockstep cluster is a family of packages published together: each member",
  "pins its siblings at its own version, so a duplicate inside the family only",
  "disappears when the whole family moves to a single version.",
];

const directionLabel = (direction: ClusterFix["direction"]): string => {
  if (direction === "down") return " (downgrade)";
  if (direction === "up") return " (upgrade)";
  return "";
};

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const constraintText = (requesterName: string | undefined): string =>
  requesterName ?? "workspace";

const renderPackage = (
  view: DuplicatePackageView,
  clusterIndex: number | undefined,
  color: Colorize,
  log: (message?: string) => void,
): void => {
  log();
  log(`${color("bold", view.packageName)}:`);

  if (clusterIndex !== undefined) {
    log(`  ${color("dim", "Cluster:")} ${clusterIndex}`);
  }

  log(`  ${color("dim", "Resolutions:")}`);
  for (const { resolution, installations } of view.resolutions) {
    log(`    - ${color("yellow", resolution)}`);
    if (installations.length > 1) {
      log(`      ${color("dim", "Installed at:")}`);
      for (const location of installations) {
        log(`        - ${location}`);
      }
    }
  }

  if (view.dependents.length > 0) {
    log(`  ${color("dim", "Dependents:")}`);
    for (const dependent of view.dependents) {
      const resolved =
        dependent.resolvedVersion !== undefined &&
        dependent.resolvedVersion !== dependent.range
          ? `, resolved ${color("yellow", dependent.resolvedVersion)}`
          : "";
      log(
        `    - ${dependent.requester} requires ${color("yellow", `"${dependent.range}"`)}${resolved}`,
      );
    }
  }

  if (view.dedupe.length > 0) {
    log(`  ${color("dim", "Dedupe:")}`);
    for (const { from, to, direction } of view.dedupe) {
      log(
        `    - ${color("yellow", from.join(", "))} -> ${color("green", to)}${directionLabel(direction ?? "none")}`,
      );
    }
  }
};

const renderCluster = (
  fix: ClusterFix,
  index: number,
  color: Colorize,
  log: (message?: string) => void,
): void => {
  const fixable = fix.applicable ? fix.convergentMembers.length : 0;
  const counts = [
    plural(fix.members.length, "package", "packages"),
    `${fix.duplicatedMembers.length} duplicated`,
    `${fixable} fixable`,
  ].join(", ");

  log();
  log(
    `cluster ${index} — ${color("bold", clusterLabel(fix.members))} [${counts}]:`,
  );

  log(`  ${color("dim", "Members:")}`);
  const width = Math.max(...fix.members.map((member) => member.length));
  for (const member of fix.members) {
    const installed = fix.memberVersions[member];
    const versions = color("yellow", installed?.versions.join(", ") ?? "");
    const nonNpm =
      installed && installed.nonNpmCount > 0
        ? color("dim", ` (+${installed.nonNpmCount} non-npm)`)
        : "";
    log(`    - ${member.padEnd(width)}  ${versions}${nonNpm}`);
  }

  if (fix.applicable && fix.target !== null) {
    log(
      `  ${color("dim", "Dedupe:")} ${color("green", fix.target)}${directionLabel(fix.direction)}`,
    );
    if (fix.driverMembers.length > 0) {
      const followers = fix.convergentMembers.length - fix.driverMembers.length;
      const follow =
        followers > 0
          ? color(
              "dim",
              ` (${plural(followers, "member follows", "members follow")})`,
            )
          : "";
      log(
        `    ${color("dim", "Driven by:")} ${fix.driverMembers.join(", ")}${follow}`,
      );
    }
    // nothing pins these, so the package manager picks their version: the
    // fixable count above is not a guarantee for them
    if (fix.floatingMembers.length > 0) {
      log(
        `    ${color("dim", "Resolver picks:")} ${fix.floatingMembers.join(", ")}`,
      );
    }
  }

  if (fix.excludedMembers.length > 0) {
    log(`  ${color("dim", "Remaining duplicates:")}`);
    for (const excluded of fix.excludedMembers) {
      const blockers = excluded.blockedBy
        .map(
          (constraint) =>
            `${constraintText(constraint.requesterName)} requires ${color("yellow", `"${constraint.range}"`)}`,
        )
        .join(", ");
      log(`    - ${color("red", excluded.packageName)}: ${blockers}`);
    }
  }

  if (fix.reuseFixes.length > 0) {
    log(
      `  ${color("dim", `Open ranges not reusing the pinned ${fix.anchor ?? ""}:`)}`,
    );
    for (const reuse of fix.reuseFixes) {
      log(
        `    - ${reuse.requesterName} requires ${reuse.packageName} ${color("yellow", `"${reuse.range}"`)}, resolved ${color("yellow", reuse.from)} -> would pin ${color("green", reuse.to)}`,
      );
    }
  }

  if (fix.externalConstraints.length > 0) {
    log(`  ${color("dim", "External constraints:")}`);
    for (const constraint of fix.externalConstraints) {
      log(
        `    - ${constraintText(constraint.requesterName)} requires ${constraint.packageName} ${color("yellow", `"${constraint.range}"`)}`,
      );
    }
  }
};

// A package counts once, whether its own resolutions can merge, its cluster
// converges it, or both.
const countDedupable = (
  packages: DuplicatePackageView[],
  clusters: ClusterFix[],
): number => {
  const names = new Set(
    packages
      .filter((view) => view.dedupe.length > 0)
      .map((view) => view.packageName),
  );
  for (const fix of clusters) {
    if (!fix.applicable) continue;
    for (const member of fix.convergentMembers) names.add(member);
  }
  return names.size;
};

export const renderDuplicatesReport = ({
  title,
  packages,
  totalDependencies,
  clusterFixes = [],
  dedupeCommand,
  color: colorEnabled = shouldColorize(),
  log = console.log,
}: DuplicatesReportOptions): void => {
  const color = createColorize(colorEnabled);
  const titleSingular = title === "duplicates" ? "duplicate" : "match";

  if (packages.length === 0) {
    log("No duplicates found");
  } else {
    log(`Found ${plural(packages.length, titleSingular, title)}:`);
  }

  // a cluster of one carries no family to explain: it is rendered as the
  // package's own fix, in its own block
  const clusters = clusterFixes.filter(
    (fix) => fix.duplicatedMembers.length > 0 && fix.members.length > 1,
  );
  const clusterIndexes = new Map<string, number>();
  clusters.forEach((fix, index) => {
    for (const member of fix.members) {
      if (!clusterIndexes.has(member)) clusterIndexes.set(member, index + 1);
    }
  });

  for (const view of packages) {
    renderPackage(view, clusterIndexes.get(view.packageName), color, log);
  }

  if (clusters.length > 0) {
    log();
    log(color("dim", "Lockstep clusters:"));
    for (const line of clusterExplanation) {
      log(`  ${color("dim", line)}`);
    }
    clusters.forEach((fix, index) => {
      renderCluster(fix, index + 1, color, log);
    });
  }

  const dedupable = countDedupable(packages, clusters);
  const summary = `Found ${plural(totalDependencies, "dependency", "dependencies")}, ${plural(packages.length, titleSingular, title)}, ${dedupable} dedupable.`;

  log();
  log(
    dedupable === 0
      ? summary
      : `${summary} Run ${color("cyan", `\`${dedupeCommand}\``)} to apply.`,
  );
};
