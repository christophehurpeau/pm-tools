import type { ClusterExternalConstraint, ClusterFix } from "./identifyLockstepClusterFixes.ts";
import type { PlannedOverride } from "./planClusterApply.ts";
export interface RejectedOverride {
    override: PlannedOverride;
    rejectedBy: ClusterExternalConstraint[];
}
export interface PartitionedOverrides {
    safe: PlannedOverride[];
    rejected: RejectedOverride[];
}
/**
 * Split the planned overrides for a package manager whose overrides apply to
 * every requester of the package, whatever range it declares (bun's
 * `overrides`, pnpm's plain ones). Such an override cannot spare the dependents
 * a conditional one would — pnpm's convergence overrides only repoint the edges
 * that accept the version — so one a third-party range rejects would force that
 * dependent onto a version it never allowed.
 *
 * The `converge` overrides are safe by construction: the detector only converges
 * a member no third-party range holds elsewhere. A `reuse` override is derived
 * from a single requester's range, and another requester can still reject it.
 */
export declare const partitionUnconditionalOverrides: (fixes: ClusterFix[], overrides: PlannedOverride[]) => PartitionedOverrides;
//# sourceMappingURL=unconditionalOverrides.d.ts.map