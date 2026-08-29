import type { YarnLockPackages } from "./parseYarnLockPackages.ts";
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
export type ManifestReader = (workspacePath: string) => Record<string, unknown> | undefined;
export declare const createManifestReader: (projectDir: string) => ManifestReader;
/**
 * Which dependency block a workspace declares a range in exists only in the
 * manifest: the lockfile folds a workspace's dependencies and devDependencies
 * into one `dependencies` map, and `applyWorkspaceRangeEdit` needs the block to
 * scope its edit. The lockfile is still what enumerates the workspaces, and it
 * still answers when a manifest cannot be read — with every range attributed to
 * `dependencies`, which is wrong often enough that such an edit is reported
 * unresolvable rather than applied.
 */
export declare const collectWorkspaces: (packages: YarnLockPackages, readManifest: ManifestReader) => Workspace[];
//# sourceMappingURL=collectWorkspaces.d.ts.map