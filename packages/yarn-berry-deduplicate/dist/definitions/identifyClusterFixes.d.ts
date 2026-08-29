import type { ClusterFix } from "pm-utils";
import type { PackagesMap } from "./helpers/buildYarnPackagesMap.ts";
import type { Workspace } from "./helpers/collectWorkspaces.ts";
import type { YarnLockPackages } from "./helpers/parseYarnLockPackages.ts";
export type { ClusterExternalConstraint, ClusterFix, ClusterReuseFix, } from "pm-utils";
export declare const identifyClusterFixes: (packagesMap: PackagesMap, packages: YarnLockPackages, workspaces: Workspace[]) => ClusterFix[];
//# sourceMappingURL=identifyClusterFixes.d.ts.map