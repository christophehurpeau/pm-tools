import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
import type { WorkspaceRangeEdit } from "./workspaceManifest.ts";
export interface PlannedManifestEdit extends WorkspaceRangeEdit {
    importerPath: string;
}
export interface PlannedOverride {
    packageName: string;
    version: string;
    reason: "converge" | "reuse";
}
export interface ClusterApplyPlan {
    manifestEdits: PlannedManifestEdit[];
    overrides: PlannedOverride[];
    conflicts: {
        packageName: string;
        kept: string;
        dropped: string;
    }[];
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
export declare const planClusterApply: (fixes: ClusterFix[]) => ClusterApplyPlan;
//# sourceMappingURL=planClusterApply.d.ts.map