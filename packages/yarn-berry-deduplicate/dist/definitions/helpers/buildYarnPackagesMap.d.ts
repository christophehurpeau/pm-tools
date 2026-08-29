import type { YarnLockPackages, YarnPackage } from "./parseYarnLockPackages.ts";
export interface PackageResolution {
    resolution: string;
    package: YarnPackage;
    /** every descriptor that resolves here, in lockfile order */
    installations: string[];
}
export type PackagesMap = Record<string, PackageResolution[]>;
export declare const buildYarnPackagesMap: (packages: YarnLockPackages) => PackagesMap;
export declare const filterDuplicatesYarnPackagesMap: (packagesMap: PackagesMap) => PackagesMap;
//# sourceMappingURL=buildYarnPackagesMap.d.ts.map