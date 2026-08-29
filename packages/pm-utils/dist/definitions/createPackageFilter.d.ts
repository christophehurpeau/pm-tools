import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
export interface PackageFilterOptions {
    include?: string[];
    exclude?: string[];
    includeScopes?: string[];
    excludeScopes?: string[];
}
export interface PackageFilter {
    selectsEverything: boolean;
    selects: (packageName: string) => boolean;
    rejectionReason: (packageName: string) => string | undefined;
}
/**
 * Selects the packages a dedupe run is allowed to touch. Deduplicating a large
 * lockfile in one pass produces a diff no one reviews, so every tool exposes
 * this as the way to work through it a family at a time.
 *
 * A package is selected when the include list is empty or one of its patterns
 * matches, and no exclude pattern matches — exclusion always wins, so a scope
 * can be selected with a few of its packages held back.
 *
 * Patterns are globs with path semantics (`*` stops at `/`), the same as the
 * `why-duplicate` filters: `@babel/*` matches `@babel/core`, a bare `*` does
 * not. npm names carry no glob metacharacter, so a plain name is still an
 * exact match.
 */
export declare const createPackageFilter: ({ include, exclude, includeScopes, excludeScopes, }?: PackageFilterOptions) => PackageFilter;
export declare const selectPackages: <T>(packages: Record<string, T>, filter: PackageFilter) => Record<string, T>;
export interface SkippedClusterFix {
    fix: ClusterFix;
    blockedBy: string[];
}
export interface SelectedClusterFixes {
    selected: ClusterFix[];
    skipped: SkippedClusterFix[];
}
/**
 * A cluster fix moves its whole family in lockstep, so it is kept only when
 * every member is selected: applying it for part of a family would move the
 * rest anyway, past the filter the user set. Select a family with a scope, or
 * by naming all of its members.
 */
export declare const selectClusterFixes: (fixes: ClusterFix[], filter: PackageFilter) => SelectedClusterFixes;
export declare const describeSkippedClusterFix: ({ fix, blockedBy, }: SkippedClusterFix) => string;
//# sourceMappingURL=createPackageFilter.d.ts.map