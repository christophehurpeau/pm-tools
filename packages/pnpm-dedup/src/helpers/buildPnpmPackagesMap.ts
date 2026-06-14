import type {
  NpmPackage,
  Package,
  ParsedPnpmPackages,
} from "./parsePnpmLockPackages.ts";

export interface PackageResolution {
  resolution: string;
  package: Package;
  installations: string[];
}

export interface NpmPackageResolution extends PackageResolution {
  package: NpmPackage;
}

export type PackagesMap = Record<string, PackageResolution[]>;

// Several packages can share the same name but different versions (duplicates).
// When a single resolution is installed in several peer contexts, every context
// is listed in `installations`.
export function buildPnpmPackagesMap({
  packages,
  installationsByResolution,
}: ParsedPnpmPackages): PackagesMap {
  const packagesMap: PackagesMap = {};

  for (const pkg of packages.values()) {
    if (!packagesMap[pkg.name]) {
      packagesMap[pkg.name] = [];
    }

    packagesMap[pkg.name]!.push({
      resolution: pkg.resolution,
      package: pkg,
      installations: installationsByResolution.get(pkg.resolution) ?? [
        pkg.resolution,
      ],
    });
  }

  return packagesMap;
}

export function filterDuplicatesPnpmPackagesMap(
  packagesMap: PackagesMap,
): PackagesMap {
  return Object.fromEntries(
    Object.entries(packagesMap).filter(
      ([, resolutions]) => resolutions.length > 1,
    ),
  );
}
