import type { PnpmLockFile } from "../pnpmLockTypes.ts";
export interface NpmPackage {
    type: "npm";
    name: string;
    version: string;
    resolution: string;
}
export interface OtherPackage {
    type: "other";
    name: string;
    version: string;
    resolution: string;
}
export type Package = NpmPackage | OtherPackage;
export type PnpmLockPackages = Map<string, Package>;
export interface ParsedPnpmPackages {
    packages: PnpmLockPackages;
    installationsByResolution: Map<string, string[]>;
}
/**
 * Strip a pnpm peer-dependency suffix (everything from the first `(`).
 *
 * eg `@scope/name@1.2.3(eslint@9)(typescript@5)` -> `@scope/name@1.2.3`
 */
export declare const stripPeerSuffix: (id: string) => string;
/**
 * Parse a pnpm package id (`name@version`, optionally peer-suffixed) into its
 * name and version. Handles scoped names (`@scope/name@1.2.3`).
 */
export declare const parsePackageId: (id: string) => {
    name: string;
    version: string;
};
/**
 * Resolve a snapshot dependency entry. The value is either a resolved version
 * (`1.2.3`, possibly peer-suffixed) for which the key is the real npm name, or
 * an aliased `realName@version` form when the key is a local alias.
 */
export declare const resolveSnapshotDependency: (depName: string, depValue: string) => {
    name: string;
    version: string;
};
export declare const parsePnpmLockPackages: (lock: PnpmLockFile) => ParsedPnpmPackages;
//# sourceMappingURL=parsePnpmLockPackages.d.ts.map