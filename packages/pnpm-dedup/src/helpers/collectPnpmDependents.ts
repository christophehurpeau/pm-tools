import { PackageDependencyDescriptorUtils } from "pm-utils";
import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import { parsePackageId, stripPeerSuffix } from "./parsePnpmLockPackages.ts";

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

// In a snapshot, a dependency value is either a resolved version (`1.2.3`,
// possibly peer-suffixed) for which the key is the real npm name, or an aliased
// `realName@version` form when the key is a local alias.
const resolveSnapshotDependency = (
  depName: string,
  depValue: string,
): { name: string; version: string } => {
  const stripped = stripPeerSuffix(depValue);
  if (/^\d/.test(stripped)) {
    return { name: depName, version: stripped };
  }
  const { name, version } = parsePackageId(stripped);
  return { name: name || depName, version };
};

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
        const parsedDep = PackageDependencyDescriptorUtils.parse(
          depName,
          specifier,
        );
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
