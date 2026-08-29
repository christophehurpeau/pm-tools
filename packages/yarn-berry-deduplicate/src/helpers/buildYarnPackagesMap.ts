import type { YarnLockPackages, YarnPackage } from "./parseYarnLockPackages.ts";

export interface PackageResolution {
  resolution: string;
  package: YarnPackage;
  /** every descriptor that resolves here, in lockfile order */
  installations: string[];
}

export type PackagesMap = Record<string, PackageResolution[]>;

export const buildYarnPackagesMap = (
  packages: YarnLockPackages,
): PackagesMap => {
  const resolutionsMap = new Map<string, PackageResolution>();
  const packagesMap: PackagesMap = {};

  for (const [descriptorString, yarnPackage] of packages) {
    const existing = resolutionsMap.get(yarnPackage.resolution);
    if (existing) {
      existing.installations.push(descriptorString);
      continue;
    }

    const packageResolution: PackageResolution = {
      resolution: yarnPackage.resolution,
      package: yarnPackage,
      installations: [descriptorString],
    };
    resolutionsMap.set(yarnPackage.resolution, packageResolution);
    packagesMap[yarnPackage.name] ??= [];
    packagesMap[yarnPackage.name]!.push(packageResolution);
  }

  return packagesMap;
};

export const filterDuplicatesYarnPackagesMap = (
  packagesMap: PackagesMap,
): PackagesMap =>
  Object.fromEntries(
    Object.entries(packagesMap).filter(
      ([, resolutions]) => resolutions.length > 1,
    ),
  );
