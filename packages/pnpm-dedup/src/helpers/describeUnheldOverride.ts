import type { PlannedOverride } from "pm-dedup-core";
import semver from "semver";
import type { DependentRange } from "./collectDependentRanges.ts";

const rejects = (version: string, range: string): boolean =>
  semver.validRange(range) !== null &&
  !semver.satisfies(version, range, { includePrerelease: true });

const describeDependent = (
  dependent: DependentRange & { resolvedVersion: string },
  version: string,
): string => {
  const declared = `${dependent.key} requires "${dependent.range}"`;
  if (rejects(version, dependent.range)) {
    return dependent.peer ? `${declared} (peer)` : declared;
  }
  // pnpm provides a peer from the parent's context rather than resolving it
  return dependent.peer
    ? `${declared} (peer), is provided ${dependent.resolvedVersion}`
    : `${declared}, resolves ${dependent.resolvedVersion} without an override`;
};

/**
 * Why an override did not hold, as one line per edge still resolving away from
 * its version, the ranges that reject it first: those are what blocks the merge.
 *
 * Several peer contexts of one requester share a key, so lines are counted once.
 */
export const describeUnheldOverride = (
  override: PlannedOverride,
  dependents: DependentRange[],
): string[] => {
  const offVersion = dependents.filter(
    (dependent): dependent is DependentRange & { resolvedVersion: string } =>
      dependent.resolvedVersion !== undefined &&
      dependent.resolvedVersion !== override.version,
  );

  const blockersFirst = offVersion.toSorted(
    (a, b) =>
      Number(rejects(override.version, b.range)) -
        Number(rejects(override.version, a.range)) ||
      a.key.localeCompare(b.key),
  );

  return [
    ...new Set(
      blockersFirst.map((dependent) =>
        describeDependent(dependent, override.version),
      ),
    ),
  ];
};
