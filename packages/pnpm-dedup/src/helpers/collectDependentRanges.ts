import { PackageDependencyDescriptorUtils } from "pm-utils";
import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import { parsePackageId, stripPeerSuffix } from "./parsePnpmLockPackages.ts";
import type {
  InstalledManifest,
  ManifestReader,
} from "./readInstalledManifest.ts";

export interface DependentRange {
  key: string;
  range: string;
}

export type DependentRangesMap = Map<string, DependentRange[]>;

const snapshotDepTypes = ["dependencies", "optionalDependencies"] as const;
const manifestDepTypes = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const resolveSnapshotName = (depName: string, depValue: string): string => {
  const stripped = stripPeerSuffix(depValue);
  if (/^\d/.test(stripped)) {
    return depName;
  }
  return parsePackageId(stripped).name || depName;
};

const manifestRange = (
  manifest: InstalledManifest | undefined,
  depName: string,
): string | undefined => {
  if (!manifest) return undefined;
  for (const depType of manifestDepTypes) {
    const declared = manifest[depType]?.[depName];
    if (declared) {
      return PackageDependencyDescriptorUtils.parse(depName, declared).selector;
    }
  }
  return undefined;
};

/**
 * Collect, for each duplicated package, the real semver range every dependent
 * declares. Direct (importer) dependents carry their specifier; transitive
 * dependents' ranges are read from their installed manifest (the pnpm lockfile
 * only stores the resolved version, not the range). When a manifest is missing
 * (project not installed), the resolved version is used as an exact fallback.
 */
export const collectDependentRanges = (
  lock: PnpmLockFile,
  duplicatePackageNames: Set<string>,
  readManifest: ManifestReader,
): DependentRangesMap => {
  const rangesMap: DependentRangesMap = new Map();

  const add = (name: string, dependent: DependentRange): void => {
    if (!duplicatePackageNames.has(name)) return;
    let dependents = rangesMap.get(name);
    if (!dependents) {
      dependents = [];
      rangesMap.set(name, dependents);
    }
    dependents.push(dependent);
  };

  for (const [importerPath, project] of Object.entries(lock.importers ?? {})) {
    (
      ["dependencies", "devDependencies", "optionalDependencies"] as const
    ).forEach((depType) => {
      const deps = project[depType];
      if (!deps) return;
      for (const [depName, { specifier }] of Object.entries(deps)) {
        const parsed = PackageDependencyDescriptorUtils.parse(
          depName,
          specifier,
        );
        add(parsed.npmName, {
          key: `${importerPath === "." ? "package.json" : importerPath} in ${depType}`,
          range: parsed.selector,
        });
      }
    });
  }

  for (const [snapshotKey, snapshot] of Object.entries(lock.snapshots ?? {})) {
    const dependent = parsePackageId(snapshotKey);
    snapshotDepTypes.forEach((depType) => {
      const deps = snapshot[depType];
      if (!deps) return;
      for (const [depName, depValue] of Object.entries(deps)) {
        const name = resolveSnapshotName(depName, depValue);
        if (!duplicatePackageNames.has(name)) continue;
        const range =
          manifestRange(
            readManifest(dependent.name, dependent.version),
            depName,
          ) ?? stripPeerSuffix(depValue);
        add(name, {
          key: `${dependent.name}@${dependent.version}`,
          range,
        });
      }
    });
  }

  return rangesMap;
};
