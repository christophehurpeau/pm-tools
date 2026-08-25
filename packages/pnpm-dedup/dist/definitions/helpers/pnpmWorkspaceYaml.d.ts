/**
 * A convergence override (pnpm >= 11.13.0) is an override key with an empty
 * range selector. It repoints a dependency edge only when the edge's declared
 * range accepts the exact version, so the members a third-party range
 * legitimately pins elsewhere keep their own resolution instead of being forced.
 * The plain key is the unconditional one: every requester gets the version.
 */
export declare const overrideKey: (packageName: string, convergence: boolean) => string;
export interface AddOverridesOptions {
    convergence?: boolean;
    comment?: string;
}
/**
 * Add overrides to a `pnpm-workspace.yaml`, editing the document rather than
 * reserializing it: the user's comments, key order and formatting have to
 * survive. Pass `undefined` for a file that does not exist yet.
 *
 * `comment` is attached above the first entry added, not above the `overrides`
 * key, so an existing block and whatever the user wrote about it stay untouched.
 */
export declare const addOverrides: (content: string | undefined, overrides: Map<string, string>, { convergence, comment }?: AddOverridesOptions) => string;
export declare const readConvergenceOverrides: (content: string) => Map<string, string>;
//# sourceMappingURL=pnpmWorkspaceYaml.d.ts.map