export interface InstalledManifest {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}
export type ManifestReader = (name: string, version: string) => InstalledManifest | undefined;
/**
 * Build a reader that locates an installed package's manifest under
 * `node_modules/.pnpm`. pnpm stores each package at
 * `node_modules/.pnpm/<name with / replaced by +>@<version>[(peers)|_hash]/node_modules/<name>/package.json`.
 *
 * Returns `undefined` when the project is not installed or the package is
 * absent, so callers degrade gracefully (no transitive ranges available).
 */
export declare const createManifestReader: (projectDir: string) => ManifestReader;
//# sourceMappingURL=readInstalledManifest.d.ts.map