import type { PackageFilterOptions } from "pm-utils";
export type DedupeMode = "apply" | "check" | "dry-run";
export interface DedupeOptions {
    mode?: DedupeMode;
    convergenceOverrides?: boolean;
    filter?: PackageFilterOptions;
}
/**
 * `pnpm dedupe` only merges what it can resolve to a single version on its own:
 * it never widens a workspace range, and it never repoints an edge that resolved
 * past a version the family already carries. Cluster fixes cover exactly that
 * gap, so they run first and `pnpm dedupe` finishes the residuals.
 */
export declare function dedupe({ mode, convergenceOverrides, filter, }?: DedupeOptions): void;
//# sourceMappingURL=dedupe.d.ts.map