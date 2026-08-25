export interface InstalledManifest {
    version?: string;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}
export type ManifestReader = (name: string, version: string) => InstalledManifest | undefined;
export interface ManifestReaderStats {
    found: number;
    missed: number;
}
/**
 * Build a reader that locates an installed package's manifest, whichever
 * node-linker the project uses:
 *
 * - virtual store (pnpm's default): the dep path gives the directory,
 *   `node_modules/.pnpm/<name with / replaced by +>@<version>[(peers)|_hash]/node_modules/<name>`;
 * - `nodeLinker: hoisted`: the layout is npm-shaped and placement is a hoisting
 *   decision, so `node_modules/.modules.yaml` is consulted for the exact paths;
 *   a flat `node_modules/<name>` and one level of nesting are tried as a
 *   fallback when that file is missing.
 *
 * `stats` tells callers whether anything was readable at all: every declared
 * range comes from these manifests, so a reader that finds nothing silently
 * turns every dependent's range into an exact pin and hides every fix.
 */
export declare const createManifestReaderWithStats: (projectDir: string) => {
    readManifest: ManifestReader;
    stats: () => ManifestReaderStats;
};
export declare const createManifestReader: (projectDir: string) => ManifestReader;
//# sourceMappingURL=readInstalledManifest.d.ts.map