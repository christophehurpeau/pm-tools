import type { NpmPackage, Package, ParsedPnpmPackages } from "./parsePnpmLockPackages.ts";
export interface PackageResolution {
    resolution: string;
    package: Package;
    installations: string[];
}
export interface NpmPackageResolution extends PackageResolution {
    package: NpmPackage;
}
export type PackagesMap = Record<string, PackageResolution[]>;
export declare function buildPnpmPackagesMap({ packages, installationsByResolution, }: ParsedPnpmPackages): PackagesMap;
export declare function filterDuplicatesPnpmPackagesMap(packagesMap: PackagesMap): PackagesMap;
//# sourceMappingURL=buildPnpmPackagesMap.d.ts.map