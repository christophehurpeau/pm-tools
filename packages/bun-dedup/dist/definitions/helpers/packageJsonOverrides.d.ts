/**
 * Add bun overrides to a workspace root `package.json`. The manifest is
 * reserialized rather than patched in place, which is only acceptable because
 * the overrides are transient: the original text is restored from the snapshot
 * once the resolution they force is verified.
 */
export declare const addOverrides: (content: string, overrides: Map<string, string>) => string;
//# sourceMappingURL=packageJsonOverrides.d.ts.map