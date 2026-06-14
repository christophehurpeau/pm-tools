import type { PnpmLockFile } from "../pnpmLockTypes.ts";

export interface NpmPackage {
  type: "npm";
  name: string;
  version: string;
  resolution: string;
}

export interface OtherPackage {
  type: "other";
  name: string;
  version: string;
  resolution: string;
}

export type Package = NpmPackage | OtherPackage;

export type PnpmLockPackages = Map<string, Package>;

export interface ParsedPnpmPackages {
  packages: PnpmLockPackages;
  installationsByResolution: Map<string, string[]>;
}

/**
 * Strip a pnpm peer-dependency suffix (everything from the first `(`).
 *
 * eg `@scope/name@1.2.3(eslint@9)(typescript@5)` -> `@scope/name@1.2.3`
 */
export const stripPeerSuffix = (id: string): string => {
  const parenPos = id.indexOf("(");
  return parenPos === -1 ? id : id.slice(0, parenPos);
};

/**
 * Parse a pnpm package id (`name@version`, optionally peer-suffixed) into its
 * name and version. Handles scoped names (`@scope/name@1.2.3`).
 */
export const parsePackageId = (
  id: string,
): { name: string; version: string } => {
  const base = stripPeerSuffix(id);
  const atPos = base.lastIndexOf("@");
  if (atPos <= 0) {
    return { name: base, version: "" };
  }
  return { name: base.slice(0, atPos), version: base.slice(atPos + 1) };
};

const isNpmVersion = (version: string): boolean => {
  return /^\d/.test(version);
};

export const parsePnpmLockPackages = (
  lock: PnpmLockFile,
): ParsedPnpmPackages => {
  const packages: PnpmLockPackages = new Map();

  for (const resolution of Object.keys(lock.packages ?? {})) {
    const { name, version } = parsePackageId(resolution);
    packages.set(resolution, {
      type: isNpmVersion(version) ? "npm" : "other",
      name,
      version,
      resolution,
    });
  }

  const installationsByResolution = new Map<string, string[]>();
  for (const snapshotKey of Object.keys(lock.snapshots ?? {})) {
    const baseId = stripPeerSuffix(snapshotKey);
    const installations = installationsByResolution.get(baseId);
    if (installations) {
      installations.push(snapshotKey);
    } else {
      installationsByResolution.set(baseId, [snapshotKey]);
    }
  }

  return { packages, installationsByResolution };
};
