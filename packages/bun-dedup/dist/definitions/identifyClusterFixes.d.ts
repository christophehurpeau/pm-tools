import type { BunLockFile } from "bun";
import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import type { BunLockPackages } from "./helpers/parseBunLockPackages.ts";
export interface ClusterExternalConstraint {
    requester: string;
    requesterName: string | undefined;
    packageName: string;
    range: string;
}
export interface ClusterFix {
    members: string[];
    duplicatedMembers: string[];
    target: string | null;
    direction: "down" | "none" | "same" | "up";
    reResolutionSet: string[];
    externalConstraints: ClusterExternalConstraint[];
    needsRoundTrip: boolean;
    applicable: boolean;
}
export declare const identifyClusterFixes: (packagesMap: PackagesMap, packages: BunLockPackages, workspaces: BunLockFile["workspaces"]) => ClusterFix[];
//# sourceMappingURL=identifyClusterFixes.d.ts.map