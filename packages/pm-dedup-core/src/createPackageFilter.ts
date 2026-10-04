import picomatch from "picomatch";
import { clusterLabel } from "./clusterLabel.ts";
import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";

export interface PackageFilterOptions {
  // glob patterns matched against the full npm name, `@scope/name` included
  include?: string[];
  exclude?: string[];
  // bare scope names, with or without the leading `@`
  includeScopes?: string[];
  excludeScopes?: string[];
}

export interface PackageFilter {
  // nothing was asked for, so every package is selected and callers holding a
  // whole lockfile can skip the pass entirely
  selectsEverything: boolean;
  selects: (packageName: string) => boolean;
  // why a package is left alone, for reports; undefined when it is selected
  rejectionReason: (packageName: string) => string | undefined;
}

const scopePattern = (scope: string): string =>
  `${scope.startsWith("@") ? scope : `@${scope}`}/**`;

const toPatterns = (names: string[], scopes: string[]): string[] => [
  ...names,
  ...scopes.map(scopePattern),
];

// picomatch throws on an empty pattern list, and "no pattern" has to mean "no
// opinion" rather than "matches nothing".
const compile = (patterns: string[]): ((name: string) => boolean) =>
  patterns.length === 0 ? () => false : picomatch(patterns);

/**
 * Selects the packages a dedupe run is allowed to touch. Deduplicating a large
 * lockfile in one pass produces a diff no one reviews, so every tool exposes
 * this as the way to work through it a family at a time.
 *
 * A package is selected when the include list is empty or one of its patterns
 * matches, and no exclude pattern matches — exclusion always wins, so a scope
 * can be selected with a few of its packages held back.
 *
 * Patterns are globs with path semantics (`*` stops at `/`), the same as the
 * `why-duplicate` filters: `@babel/*` matches `@babel/core`, a bare `*` does
 * not. npm names carry no glob metacharacter, so a plain name is still an
 * exact match.
 */
export const createPackageFilter = ({
  include = [],
  exclude = [],
  includeScopes = [],
  excludeScopes = [],
}: PackageFilterOptions = {}): PackageFilter => {
  const includePatterns = toPatterns(include, includeScopes);
  const excludePatterns = toPatterns(exclude, excludeScopes);
  const isIncluded = compile(includePatterns);
  const isExcluded = compile(excludePatterns);

  const rejectionReason = (packageName: string): string | undefined => {
    if (isExcluded(packageName)) return "excluded";
    if (includePatterns.length > 0 && !isIncluded(packageName)) {
      return "not selected";
    }
    return undefined;
  };

  return {
    selectsEverything:
      includePatterns.length === 0 && excludePatterns.length === 0,
    selects: (packageName) => rejectionReason(packageName) === undefined,
    rejectionReason,
  };
};

// A map keyed by package name is where the filter applies exactly: an unselected
// package keeps every resolution it has, rather than being partly rewritten.
export const selectPackages = <T>(
  packages: Record<string, T>,
  filter: PackageFilter,
): Record<string, T> =>
  filter.selectsEverything
    ? packages
    : Object.fromEntries(
        Object.entries(packages).filter(([packageName]) =>
          filter.selects(packageName),
        ),
      );

export interface SkippedClusterFix {
  fix: ClusterFix;
  // the members that are not selected, so a fix doing nothing is never silent
  blockedBy: string[];
}

export interface SelectedClusterFixes {
  selected: ClusterFix[];
  skipped: SkippedClusterFix[];
}

/**
 * A cluster fix moves its whole family in lockstep, so it is kept only when
 * every member is selected: applying it for part of a family would move the
 * rest anyway, past the filter the user set. Select a family with a scope, or
 * by naming all of its members.
 */
export const selectClusterFixes = (
  fixes: ClusterFix[],
  filter: PackageFilter,
): SelectedClusterFixes => {
  if (filter.selectsEverything) return { selected: fixes, skipped: [] };

  const selected: ClusterFix[] = [];
  const skipped: SkippedClusterFix[] = [];

  for (const fix of fixes) {
    const blockedBy = fix.members.filter((member) => !filter.selects(member));
    if (blockedBy.length === 0) {
      selected.push(fix);
    } else {
      skipped.push({ fix, blockedBy });
    }
  }

  return { selected, skipped };
};

// A family can block on a dozen members, and naming them all buries the point.
const namedBlockers = 3;

// Phrased for the `skipped` list of an apply plan, so both tools explain a
// filtered-out family the same way.
export const describeSkippedClusterFix = ({
  fix,
  blockedBy,
}: SkippedClusterFix): string => {
  const named = blockedBy.slice(0, namedBlockers).join(", ");
  const rest = blockedBy.length - namedBlockers;
  const blockers = rest > 0 ? `${named} (+${rest} more)` : named;
  return `cluster ${clusterLabel(fix.members)}: ${blockers} not selected by the filter, and a family only converges as a whole`;
};
