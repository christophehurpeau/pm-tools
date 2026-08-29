export interface YarnEntry {
    version: string;
    resolution?: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    dependenciesMeta?: Record<string, Record<string, unknown>>;
    peerDependenciesMeta?: Record<string, Record<string, unknown>>;
    bin?: Record<string, string>;
    checksum?: string;
    conditions?: string;
    languageName?: string;
    linkType?: "hard" | "soft";
}
export interface YarnMetadata {
    version: string;
    cacheKey?: string;
}
/**
 * `__metadata` sits in the same map as the packages but is not one, so every
 * pass reads the entries through `packageEntries` rather than re-testing the
 * key and casting.
 */
export type YarnEntries = Record<string, YarnEntry | YarnMetadata>;
export declare const packageEntries: (entries: YarnEntries) => [entryKey: string, entry: YarnEntry][];
export declare const parseYarnLock: (content: string) => YarnEntries;
export declare const stringifyYarnLock: (entries: YarnEntries) => string;
//# sourceMappingURL=syml.d.ts.map