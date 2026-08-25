export interface ClusterWorkspaceRef {
    path: string;
    depType: string;
}
export interface ClusterExternalConstraint {
    requester: string;
    requesterName: string | undefined;
    packageName: string;
    range: string;
    resolvedVersion?: string;
    workspace?: ClusterWorkspaceRef;
}
export interface ClusterWorkspaceChange extends ClusterExternalConstraint {
    to: string;
}
export interface ClusterExcludedMember {
    packageName: string;
    blockedBy: ClusterExternalConstraint[];
}
export interface ClusterMember {
    npmVersions: string[];
    resolutionCount: number;
}
export type ClusterMembersMap = Record<string, ClusterMember>;
export interface ClusterDependent {
    requester: string;
    requesterName: string | undefined;
    range: string;
    workspace?: ClusterWorkspaceRef;
    resolvedVersion?: string;
}
export type ClusterDependentsMap = Map<string, ClusterDependent[]>;
export interface ClusterReuseFix {
    requester: string;
    requesterName: string;
    packageName: string;
    range: string;
    from: string;
    to: string;
}
export interface ClusterMemberVersions {
    versions: string[];
    nonNpmCount: number;
}
export interface ClusterFix {
    members: string[];
    duplicatedMembers: string[];
    memberVersions: Record<string, ClusterMemberVersions>;
    target: string | null;
    direction: "down" | "none" | "same" | "up";
    convergentMembers: string[];
    driverMembers: string[];
    excludedMembers: ClusterExcludedMember[];
    anchor: string | null;
    reuseFixes: ClusterReuseFix[];
    floatingMembers: string[];
    workspaceChanges: ClusterWorkspaceChange[];
    reResolutionSet: string[];
    externalConstraints: ClusterExternalConstraint[];
    needsRoundTrip: boolean;
    applicable: boolean;
}
/**
 * Compute dedupe opportunities for lockstep clusters (see
 * `buildLockstepClusters`) that a per-package pass cannot: a family of
 * co-versioned packages whose duplicate is kept alive only because a few
 * externally-requested members resolve high. The fix converges the family onto
 * a single version; fetching absent manifests and cascading the internal pins
 * is left to the package manager, surfaced here as `reResolutionSet` /
 * `needsRoundTrip`.
 *
 * Two kinds of external constraint are treated differently:
 * - a third-party requester's range is immutable, so a member it rejects the
 *   target for is excluded from the convergence instead of sinking the whole
 *   cluster (clusters routinely span several publishers, and one unfixable
 *   member should not hide the rest);
 * - a workspace pin belongs to the user, so it is reported as a
 *   `workspaceChanges` edit rather than a blocker.
 *
 * Ranges in `dependents` must be the ranges the requesters declare. A package
 * manager that only stores resolved versions in its lockfile has to recover
 * them (pnpm reads the installed manifests) or the constraints read as exact
 * pins and no target is found.
 */
export declare const identifyLockstepClusterFixes: (clusters: string[][], members: ClusterMembersMap, dependents: ClusterDependentsMap) => ClusterFix[];
//# sourceMappingURL=identifyLockstepClusterFixes.d.ts.map