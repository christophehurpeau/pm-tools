import type { LockstepGraph, LockstepResolution } from "pm-utils";
import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import type { PackagesMap } from "./buildPnpmPackagesMap.ts";
import { resolveSnapshotDependency } from "./parsePnpmLockPackages.ts";

const snapshotDepTypes = ["dependencies", "optionalDependencies"] as const;

const snapshotDependencies = (
  lock: PnpmLockFile,
  snapshotKey: string,
): Record<string, string> => {
  const snapshot = lock.snapshots?.[snapshotKey];
  const dependencies: Record<string, string> = {};

  snapshotDepTypes.forEach((depType) => {
    for (const [depName, depValue] of Object.entries(
      snapshot?.[depType] ?? {},
    )) {
      const resolved = resolveSnapshotDependency(depName, depValue);
      dependencies[resolved.name] = resolved.version;
    }
  });

  return dependencies;
};

/**
 * Adapt the pnpm lockfile model into the package-manager-neutral graph consumed
 * by `buildLockstepClusters`. pnpm snapshots store the *resolved* version of
 * each dependency instead of the requested range, which co-version detection
 * handles; one entry is emitted per installation, so a resolution installed in
 * several peer contexts contributes every context it appears in.
 */
export const toLockstepGraph = (
  lock: PnpmLockFile,
  packagesMap: PackagesMap,
): LockstepGraph =>
  Object.fromEntries(
    Object.entries(packagesMap).map(([name, resolutions]) => [
      name,
      resolutions.flatMap((resolution): LockstepResolution[] => {
        if (resolution.package.type !== "npm") {
          return [{ version: "", isNpm: false, dependencies: {} }];
        }
        return resolution.installations.map((snapshotKey) => ({
          version: resolution.package.version,
          isNpm: true,
          dependencies: snapshotDependencies(lock, snapshotKey),
        }));
      }),
    ]),
  );
