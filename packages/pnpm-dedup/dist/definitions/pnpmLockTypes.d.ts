/**
 * Minimal subset of the pnpm lockfile v9 structure consumed by this package.
 *
 * @see https://github.com/pnpm/spec/blob/master/lockfile/9.0.md
 */
export interface PnpmImporterDependency {
    specifier: string;
    version: string;
}
export interface ProjectSnapshot {
    dependencies?: Record<string, PnpmImporterDependency>;
    devDependencies?: Record<string, PnpmImporterDependency>;
    optionalDependencies?: Record<string, PnpmImporterDependency>;
}
export interface PackageMeta {
    resolution?: {
        integrity?: string;
        tarball?: string;
    };
    engines?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    hasBin?: boolean;
}
export interface PackageSnapshot {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    transitivePeerDependencies?: string[];
    optional?: boolean;
}
export interface PnpmLockFile {
    lockfileVersion: string;
    importers?: Record<string, ProjectSnapshot>;
    packages?: Record<string, PackageMeta>;
    snapshots?: Record<string, PackageSnapshot>;
}
//# sourceMappingURL=pnpmLockTypes.d.ts.map