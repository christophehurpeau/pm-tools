import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
import type { WorkspaceRangeEdit } from "./workspaceManifest.ts";

export interface PlannedManifestEdit extends WorkspaceRangeEdit {
  importerPath: string;
}

export interface PlannedOverride {
  packageName: string;
  version: string;
  // why it is proposed, for the log and for the diagnostic on a failed verify
  reason: "converge" | "reuse";
}

export interface ClusterApplyPlan {
  manifestEdits: PlannedManifestEdit[];
  overrides: PlannedOverride[];
  // a package two clusters want at different versions: the first one wins and
  // the loser is reported rather than silently dropped
  conflicts: { packageName: string; kept: string; dropped: string }[];
  // workspace changes carrying no importer reference, which cannot be applied
  unresolvableChanges: string[];
}

/**
 * Turn the detector's records into the two edits every package manager
 * understands:
 *
 * - a `workspaceChanges` entry is a range the user declares, so it is edited in
 *   place in the importer's `package.json`;
 * - everything else is a transitive edge, which only an override can repoint.
 *
 * The overrides are per package name and carry no scoping: a package manager
 * whose overrides apply unconditionally (bun) has to drop the ones a third-party
 * range would reject, where one with conditional overrides (pnpm's convergence
 * overrides) can write them all and let the resolver spare the members
 * `excludedMembers` lists.
 *
 * `reuseFixes` come first: they converge on `anchor`, the version the user
 * pinned, and a pin outranks a version the detector merely computed.
 */
export const planClusterApply = (fixes: ClusterFix[]): ClusterApplyPlan => {
  const manifestEdits: PlannedManifestEdit[] = [];
  const unresolvableChanges: string[] = [];
  const conflicts: ClusterApplyPlan["conflicts"] = [];
  const overrides = new Map<string, PlannedOverride>();

  const addOverride = (
    packageName: string,
    version: string,
    reason: PlannedOverride["reason"],
  ): void => {
    const existing = overrides.get(packageName);
    if (existing) {
      if (existing.version !== version) {
        conflicts.push({
          packageName,
          kept: existing.version,
          dropped: version,
        });
      }
      return;
    }
    overrides.set(packageName, { packageName, version, reason });
  };

  for (const fix of fixes) {
    for (const reuse of fix.reuseFixes) {
      addOverride(reuse.packageName, reuse.to, "reuse");
    }
  }

  for (const fix of fixes) {
    if (!fix.applicable || fix.target === null) continue;

    for (const change of fix.workspaceChanges) {
      if (!change.workspace) {
        unresolvableChanges.push(
          `${change.packageName} in ${change.requester}`,
        );
        continue;
      }
      manifestEdits.push({
        importerPath: change.workspace.path,
        depType: change.workspace.depType,
        packageName: change.packageName,
        range: change.range,
        to: change.to,
      });
    }

    for (const member of [...fix.convergentMembers, ...fix.reResolutionSet]) {
      addOverride(member, fix.target, "converge");
    }
  }

  return {
    manifestEdits,
    overrides: [...overrides.values()].toSorted((a, b) =>
      a.packageName.localeCompare(b.packageName),
    ),
    conflicts,
    unresolvableChanges,
  };
};
