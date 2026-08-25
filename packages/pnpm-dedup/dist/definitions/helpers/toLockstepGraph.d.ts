import type { LockstepGraph } from "pm-utils";
import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import type { PackagesMap } from "./buildPnpmPackagesMap.ts";
/**
 * Adapt the pnpm lockfile model into the package-manager-neutral graph consumed
 * by `buildLockstepClusters`. pnpm snapshots store the *resolved* version of
 * each dependency instead of the requested range, which co-version detection
 * handles; one entry is emitted per installation, so a resolution installed in
 * several peer contexts contributes every context it appears in.
 */
export declare const toLockstepGraph: (lock: PnpmLockFile, packagesMap: PackagesMap) => LockstepGraph;
//# sourceMappingURL=toLockstepGraph.d.ts.map