import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import {
  parsePackageId,
  resolveSnapshotDependency,
} from "./parsePnpmLockPackages.ts";
import type { PnpmProtocol } from "./pnpmProtocol.ts";

export interface Dependent {
  key: string;
  version: string;
}

export type DependentsMap = Map<string, Dependent[]>;

const importerDepTypes = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
] as const;

const snapshotDepTypes = ["dependencies", "optionalDependencies"] as const;

export function collectPnpmDependents(
  lock: PnpmLockFile,
  onlyPackageNames?: string[],
): DependentsMap {
  const dependentsMap: DependentsMap = new Map();

  const add = (name: string, dependent: Dependent): void => {
    if (onlyPackageNames && !onlyPackageNames.includes(name)) {
      return;
    }
    let dependents = dependentsMap.get(name);
    if (!dependents) {
      dependents = [];
      dependentsMap.set(name, dependents);
    }
    dependents.push(dependent);
  };

  for (const [importerPath, project] of Object.entries(lock.importers ?? {})) {
    importerDepTypes.forEach((depType) => {
      const deps = project[depType];
      if (!deps) return;
      for (const [depName, { specifier }] of Object.entries(deps)) {
        const parsedDep = PackageDependencyDescriptorUtils.parse<PnpmProtocol>(
          depName,
          specifier,
        );
        // `workspace:` and `catalog:` name something other than the npm package
        // sharing this key, so they constrain no npm version
        if (!isSemverComparable(parsedDep)) continue;
        add(parsedDep.npmName, {
          key: `${importerPath === "." ? "package.json" : importerPath} in ${depType}`,
          version: parsedDep.selector,
        });
      }
    });
  }

  for (const [snapshotKey, snapshot] of Object.entries(lock.snapshots ?? {})) {
    const { name, version } = parsePackageId(snapshotKey);
    const key = `${name}@${version}`;
    snapshotDepTypes.forEach((depType) => {
      const deps = snapshot[depType];
      if (!deps) return;
      for (const [depName, depValue] of Object.entries(deps)) {
        const resolved = resolveSnapshotDependency(depName, depValue);
        add(resolved.name, { key, version: resolved.version });
      }
    });
  }

  return dependentsMap;
}
