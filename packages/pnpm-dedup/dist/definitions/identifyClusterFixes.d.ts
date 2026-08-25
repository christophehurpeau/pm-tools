import type { ClusterFix } from "pm-utils";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import type { ManifestReader } from "./helpers/readInstalledManifest.ts";
import type { PnpmLockFile } from "./pnpmLockTypes.ts";
export type { ClusterExternalConstraint, ClusterFix, ClusterReuseFix, } from "pm-utils";
export declare const identifyClusterFixes: (lock: PnpmLockFile, packagesMap: PackagesMap, readManifest: ManifestReader) => ClusterFix[];
//# sourceMappingURL=identifyClusterFixes.d.ts.map