import type { BunLockFile } from "bun";
import { PackageDependencyDescriptorUtils } from "pm-utils";
import type { BunLockPackages, BunPackage } from "./parseBunLockPackages.ts";

export interface Dependent {
  key: string;
  version: string;
  bunPackage?: BunPackage;
  // where a workspace requester declares the range, for appliers that edit it
  workspace?: { path: string; depType: string };
  // version this requester actually got, resolved through the lockfile keys
  resolvedVersion?: string;
}

export type DependentsMap = Map<string, Dependent[]>;

// Path segments are the keys their parent declared, so an aliased dependency
// sits under the alias, not under its own name. Dropping one segment means
// dropping one declared key: two parts when it is scoped, one otherwise.
const parentPathOf = (path: string): string => {
  const segments = path.split("/");
  return segments
    .slice(0, segments.at(-2)?.startsWith("@") ? -2 : -1)
    .join("/");
};

/**
 * A bun.lock key is the install path of the package: `semver` at the top level,
 * `eslint-plugin-react/semver` for a copy nested under a dependent. So the
 * version a requester actually got is found the way node resolves it — nearest
 * enclosing path first, then up to the top level. `depKey` is the key the
 * requester declared, which is what the path segment carries.
 */
const resolveInstalledVersion = (
  packages: BunLockPackages,
  requesterPath: string,
  depKey: string,
): string | undefined => {
  const versionAt = (key: string): string | undefined => {
    const pkg = packages.get(key);
    return pkg?.type === "npm" ? pkg.version : undefined;
  };

  let path = requesterPath;
  while (path !== "") {
    const found = versionAt(`${path}/${depKey}`);
    if (found !== undefined) return found;

    path = parentPathOf(path);
  }

  return versionAt(depKey);
};

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
    workspace?: { path: string; depType: string },
    // install path of the requester, for the resolved-version lookup
    lookupPath = "",
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
      dependentPackage.push({
        key,
        version: depVersion,
        bunPackage,
        workspace,
        resolvedVersion: resolveInstalledVersion(
          packages,
          lookupPath,
          parsedDep.key,
        ),
      });
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
          undefined,
          { path: workspacePath, depType },
          // a nested copy under a workspace is keyed by the workspace *name*,
          // not its directory; the root's own deps are the top-level keys
          workspacePath === "" ? "" : (workspacePackage.name ?? ""),
        );
      }
    });
  }

  for (const [key, pkg] of packages.entries()) {
    if (pkg.type === "root" || pkg.type === "workspace") continue;
    if (!pkg.info.dependencies) continue;

    iterateDependencies(pkg.info.dependencies, key, pkg, undefined, key);
  }

  return dependentsMap;
}
