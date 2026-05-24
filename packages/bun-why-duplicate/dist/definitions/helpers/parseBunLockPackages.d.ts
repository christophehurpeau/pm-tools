import type { BunLockFile, BunLockFilePackageInfo } from "bun";
export interface BunNpmPackage {
    type: "npm";
    name: string;
    resolution: string;
    version: string;
    registry: string;
    info: BunLockFilePackageInfo;
    integrity: string;
}
interface BunSymlinkPackage {
    type: "symlink";
    name: string;
    resolution: string;
    path: string;
    info: BunLockFilePackageInfo;
}
interface BunFolderPackage {
    type: "folder";
    name: string;
    resolution: string;
    path: string;
    info: BunLockFilePackageInfo;
}
interface BunWorkspacePackage {
    type: "workspace";
    name: string;
    resolution: string;
    path: string;
}
interface BunTarballPackage {
    type: "tarball";
    name: string;
    resolution: string;
    tarball: string;
    info: BunLockFilePackageInfo;
}
interface BunRootPackage {
    type: "root";
    name: string;
    resolution: string;
    bin: string;
    binDir: string;
}
interface BunGitPackage {
    type: "git";
    name: string;
    resolution: string;
    repo: string;
    info: BunLockFilePackageInfo;
}
interface BunGithubPackage {
    type: "github";
    name: string;
    resolution: string;
    user: string;
    repo: string;
    info: BunLockFilePackageInfo;
}
export type BunPackage = BunFolderPackage | BunGithubPackage | BunGitPackage | BunNpmPackage | BunRootPackage | BunSymlinkPackage | BunTarballPackage | BunWorkspacePackage;
export type BunLockPackages = Map<string, BunPackage>;
export declare const parseBunLockPackages: (bunLockResult: BunLockFile) => BunLockPackages;
export {};
//# sourceMappingURL=parseBunLockPackages.d.ts.map