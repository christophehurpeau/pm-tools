import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { YarnLockPackages } from "./parseYarnLockPackages.ts";
import { parseYarnDescriptor } from "./yarnDescriptor.ts";

export interface WorkspaceDependency {
  key: string;
  value: string;
  depType: string;
}

export interface Workspace {
  /** relative to the project root; `""` for the root workspace itself */
  path: string;
  name: string | undefined;
  dependencies: WorkspaceDependency[];
}

export type ManifestReader = (
  workspacePath: string,
) => Record<string, unknown> | undefined;

export const createManifestReader =
  (projectDir: string): ManifestReader =>
  (workspacePath) => {
    try {
      return JSON.parse(
        readFileSync(join(projectDir, workspacePath, "package.json"), "utf8"),
      ) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  };

const depTypes = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
] as const;

const fromManifest = (
  manifest: Record<string, unknown>,
): WorkspaceDependency[] =>
  depTypes.flatMap((depType) => {
    const deps = manifest[depType];
    if (typeof deps !== "object" || deps === null) return [];
    return Object.entries(deps as Record<string, string>).map(
      ([key, value]) => ({ key, value, depType }),
    );
  });

/**
 * Which dependency block a workspace declares a range in exists only in the
 * manifest: the lockfile folds a workspace's dependencies and devDependencies
 * into one `dependencies` map, and `applyWorkspaceRangeEdit` needs the block to
 * scope its edit. The lockfile is still what enumerates the workspaces, and it
 * still answers when a manifest cannot be read — with every range attributed to
 * `dependencies`, which is wrong often enough that such an edit is reported
 * unresolvable rather than applied.
 */
export const collectWorkspaces = (
  packages: YarnLockPackages,
  readManifest: ManifestReader,
): Workspace[] => {
  const workspaces = new Map<string, Workspace>();

  for (const yarnPackage of packages.values()) {
    if (yarnPackage.type !== "other" || yarnPackage.protocol !== "workspace") {
      continue;
    }

    const descriptor = parseYarnDescriptor(yarnPackage.resolution);
    const path = descriptor.selector === "." ? "" : descriptor.selector;
    if (workspaces.has(path)) continue;

    const manifest = readManifest(path);

    workspaces.set(path, {
      path,
      name: yarnPackage.name,
      dependencies: manifest
        ? fromManifest(manifest)
        : Object.entries(yarnPackage.entry.dependencies ?? {}).map(
            ([key, value]) => ({ key, value, depType: "dependencies" }),
          ),
    });
  }

  return [...workspaces.values()];
};
