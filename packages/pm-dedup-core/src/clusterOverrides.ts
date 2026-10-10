import type { DuplicateSnapshot } from "./duplicateSnapshot.ts";
import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
import type { PlannedOverride } from "./planClusterApply.ts";
import type { VersionsSnapshot } from "./versionsSnapshot.ts";

/**
 * One key per open range still resolving away from the version the workspace
 * anchors its family at. A reuse fix removes no duplicate, so the duplicate set
 * cannot tell whether it took; the detector can, by no longer reporting it.
 */
export const reuseKeys = (fixes: ClusterFix[]): Set<string> =>
  new Set(
    fixes.flatMap((fix) =>
      fix.reuseFixes.map(
        (reuse) => `${reuse.requesterName}>${reuse.packageName}@${reuse.to}`,
      ),
    ),
  );

const isDuplicated = (
  duplicates: DuplicateSnapshot,
  packageName: string,
): boolean =>
  [...duplicates].some((resolution) =>
    resolution.startsWith(`${packageName}@`),
  );

export interface OverrideTargetState {
  duplicates: DuplicateSnapshot;
  versions: VersionsSnapshot;
  reuses: Set<string>;
}

/**
 * The overrides still worth writing: their package is duplicated, the edge they
 * repoint still resolves elsewhere, or — for a converging member — the package
 * sits on another version. That last case is a member nothing duplicates on its
 * own, yet whose exact pins on its siblings keep the family apart until it moves.
 */
export const outstandingOverrides = (
  overrides: PlannedOverride[],
  { duplicates, versions, reuses }: OverrideTargetState,
): PlannedOverride[] =>
  overrides.filter(
    (override) =>
      isDuplicated(duplicates, override.packageName) ||
      [...reuses].some((key) =>
        key.endsWith(`>${override.packageName}@${override.version}`),
      ) ||
      (override.reason === "converge" &&
        (versions.get(override.packageName) ?? []).some(
          (version) => version !== override.version,
        )),
  );

export interface OverrideRoundStates {
  start: { duplicates: DuplicateSnapshot };
  end: { duplicates: DuplicateSnapshot; versions: VersionsSnapshot };
  // whether every edge a reuse override repoints resolves to its version, read
  // from the lockfile: the detector stops reporting a reuse fix as soon as its
  // anchor goes away, which says nothing about the edge. Without it, no reuse
  // override holds.
  reuseHeld?: (override: PlannedOverride) => boolean;
}

/**
 * The overrides whose effect is there in `end`, compared with `start`, the
 * state the round began from. A package duplicated at the start holds once it
 * no longer is, whichever version it collapsed onto, so this never contradicts
 * the dedupe summary. One that was not duplicated only holds once it sits on
 * the override's version alone: not moving is not holding.
 */
export const heldOverrides = (
  overrides: PlannedOverride[],
  { start, end, reuseHeld }: OverrideRoundStates,
): PlannedOverride[] =>
  overrides.filter((override) => {
    if (override.reason === "reuse") return reuseHeld?.(override) ?? false;
    if (isDuplicated(start.duplicates, override.packageName)) {
      return !isDuplicated(end.duplicates, override.packageName);
    }
    const versions = end.versions.get(override.packageName) ?? [];
    return versions.length === 1 && versions[0] === override.version;
  });
