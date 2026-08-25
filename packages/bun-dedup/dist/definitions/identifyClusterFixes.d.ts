import type { BunLockFile } from "bun";
import type { ClusterFix } from "pm-utils";
import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import type { BunLockPackages } from "./helpers/parseBunLockPackages.ts";
export type { ClusterExternalConstraint, ClusterFix, ClusterReuseFix, } from "pm-utils";
export declare const identifyClusterFixes: (packagesMap: PackagesMap, packages: BunLockPackages, workspaces: BunLockFile["workspaces"]) => ClusterFix[];
//# sourceMappingURL=identifyClusterFixes.d.ts.map