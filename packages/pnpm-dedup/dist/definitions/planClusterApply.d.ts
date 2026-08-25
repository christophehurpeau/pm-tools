import type { ClusterFix } from "pm-utils";
import type { WorkspaceRangeEdit } from "./helpers/workspaceManifest.ts";
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
 * Turn the detector's records into the two edits pnpm understands:
 *
 * - a `workspaceChanges` entry is a range the user declares, so it is edited in
 *   place in the importer's `package.json`;
 * - everything else is a transitive edge, which only an override can repoint.
 *   Convergence overrides (`"pkg@": "1.2.3"`) are used rather than plain ones:
 *   they rewrite an edge only where the declared range accepts the version, so
 *   the members `excludedMembers` spares keep their own resolution instead of
 *   being forced onto a version their dependent rejects.
 *
 * `reuseFixes` come first: they converge on `anchor`, the version the user
 * pinned, and a pin outranks a version the detector merely computed.
 */
export declare const planClusterApply: (fixes: ClusterFix[]) => ClusterApplyPlan;
//# sourceMappingURL=planClusterApply.d.ts.map