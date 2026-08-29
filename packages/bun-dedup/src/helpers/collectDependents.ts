import type { BunLockFile } from "bun";
import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
import type { BunProtocol } from "./bunProtocol.ts";
import type { BunLockPackages, BunPackage } from "./parseBunLockPackages.ts";

export interface Dependent {
  key: string;
  version: string;
  // the key the requester declared, when it is not the package's own name
  // (`"psc-pinned": "npm:printable-shell-command@~5.0.0"`). A bun override
  // cannot repoint such an edge, and the report has to name which declaration
  // a range comes from
  aliasKey?: string;
  bunPackage?: BunPackage;
  // where a workspace requester declares the range, for appliers that edit it
  workspace?: { path: string; depType: string };
  // version this requester actually got, resolved through the lockfile keys
  resolvedVersion?: string;
  // the resolution this requester got, when the copy carries no npm version —
  // a tarball, a git url, a `file:` folder. The report files it under that
  // resolution; nothing else reads it.
  resolvedResolution?: string;
  // the declared value is not a semver range (`file:`, `workspace:`, a git
  // url). `version` then holds the declaration as written, protocol included,
  // because there is no range to hold instead. Such a dependent is reported and
  // never weighed: see `ResolutionDependent.nonSemver`.
  nonSemver?: true;
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
 *
 * A path segment being a declared key, the entry it names is not necessarily the
 * package being resolved: an alias can put another package under this very name
 * (`"typescript": "npm:@typescript/typescript6@6.0.2"`). Hence the name check.
 */
interface ResolveInstalledPackageOptions {
  packages: BunLockPackages;
  requesterPath: string;
  depKey: string;
  npmName: string;
}

const resolveInstalledPackage = ({
  packages,
  requesterPath,
  depKey,
  npmName,
}: ResolveInstalledPackageOptions): BunPackage | undefined => {
  const packageAt = (key: string): BunPackage | undefined => {
    const pkg = packages.get(key);
    return pkg?.name === npmName ? pkg : undefined;
  };

  let path = requesterPath;
  while (path !== "") {
    const found = packageAt(`${path}/${depKey}`);
    if (found !== undefined) return found;

    path = parentPathOf(path);
  }

  return packageAt(depKey);
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
      const parsedDep = PackageDependencyDescriptorUtils.parse<BunProtocol>(
        depName,
        depVersion,
      );

      if (onlyPackageNames && !onlyPackageNames.includes(parsedDep.npmName)) {
        continue;
      }

      // A `workspace:`, `file:` or git declaration names a different package
      // that happens to share this key, so it constrains no npm version, and it
      // is flagged rather than read as a range: taken as one,
      // `semver.satisfies` would answer "not satisfied" for every candidate and
      // suppress the merges the real dependents allow. It is still recorded —
      // such a copy is a resolution of its own in the report, and dropping the
      // only declaration that asks for it leaves that copy with no explanation
      // at all. The declaration is kept as written, protocol included, there
      // being no range to keep instead.
      const nonSemver = isSemverComparable(parsedDep) ? undefined : true;

      let dependentPackage = dependentsMap.get(parsedDep.npmName);
      if (!dependentPackage) {
        dependentPackage = [];
        dependentsMap.set(parsedDep.npmName, dependentPackage);
      }
      const resolved = resolveInstalledPackage({
        packages,
        requesterPath: lookupPath,
        depKey: parsedDep.key,
        npmName: parsedDep.npmName,
      });
      dependentPackage.push({
        key,
        version: nonSemver
          ? PackageDependencyDescriptorUtils.stringify(parsedDep)[1]
          : parsedDep.selector,
        aliasKey: parsedDep.isAlias ? parsedDep.key : undefined,
        bunPackage,
        workspace,
        resolvedVersion:
          resolved?.type === "npm" ? resolved.version : undefined,
        resolvedResolution:
          resolved && resolved.type !== "npm" ? resolved.resolution : undefined,
        nonSemver,
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
