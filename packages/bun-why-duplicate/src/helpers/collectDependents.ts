import type { BunLockFile } from "bun";
import { PackageDependencyDescriptorUtils } from "pm-utils";
import type { BunLockPackages, BunPackage } from "./parseBunLockPackages.ts";

export interface Dependent {
  key: string;
  version: string;
  bunPackage?: BunPackage;
}

export type DependentsMap = Map<string, Dependent[]>;

export function collectDependents(
  packages: BunLockPackages,
  workspaces: BunLockFile["workspaces"],
  onlyPackageNames?: string[],
): DependentsMap {
  const dependentsMap: DependentsMap = new Map();

  const iterateDependencies = (
    dependencies: Record<string, string>,
    key: string,
    bunPackage?: BunPackage,
  ): void => {
    for (const [depName, depVersion] of Object.entries(dependencies)) {
      const parsedDep = PackageDependencyDescriptorUtils.parse(
        depName,
        depVersion,
      );

      if (onlyPackageNames && !onlyPackageNames.includes(parsedDep.npmName)) {
        continue;
      }

      let dependentPackage = dependentsMap.get(parsedDep.npmName);
      if (!dependentPackage) {
        dependentPackage = [];
        dependentsMap.set(parsedDep.npmName, dependentPackage);
      }
      dependentPackage.push({ key, version: depVersion, bunPackage });
    }
  };

  for (const [workspacePath, workspacePackage] of Object.entries(workspaces)) {
    (["dependencies", "devDependencies"] as const).forEach((depType) => {
      const deps = workspacePackage[depType];
      if (deps) {
        iterateDependencies(
          deps,
          `${
            workspacePath === "" ? "package.json" : workspacePath
          } in ${depType}`,
        );
      }
    });
  }

  for (const [key, pkg] of packages.entries()) {
    if (pkg.type === "root" || pkg.type === "workspace") continue;
    if (!pkg.info.dependencies) continue;

    iterateDependencies(pkg.info.dependencies, key, pkg);
  }

  return dependentsMap;
}
