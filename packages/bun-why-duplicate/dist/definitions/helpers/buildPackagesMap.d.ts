import type { BunLockPackages, BunNpmPackage, BunPackage } from "./parseBunLockPackages.ts";
export interface PackageResolution {
    resolution: string;
    package: BunPackage;
    installations: string[];
}
export interface NpmPackageResolution extends PackageResolution {
    package: BunNpmPackage;
}
export type PackagesMap = Record<string, PackageResolution[]>;
export declare function buildPackagesMap(packages: BunLockPackages): PackagesMap;
export declare function filterDuplicatesPackagesMap(packagesMap: PackagesMap): PackagesMap;
//# sourceMappingURL=buildPackagesMap.d.ts.map