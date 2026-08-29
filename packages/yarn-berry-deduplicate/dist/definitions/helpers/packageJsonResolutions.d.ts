/**
 * Add yarn resolutions to a workspace root `package.json`. The manifest is
 * reserialized rather than patched in place, which is only acceptable because
 * the resolutions are transient: the original text is restored from the
 * snapshot once the resolution they force is verified.
 */
export declare const addResolutions: (content: string, resolutions: Map<string, string>) => string;
//# sourceMappingURL=packageJsonResolutions.d.ts.map