import type { PackageFilterOptions } from "pm-utils";
export { displayMany } from "./displayMany.ts";
export { applyClusterFixes } from "./applyClusterFixes.ts";
export { readAndParseBunLock } from "./readAndParseBunLock.ts";
export { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
export { buildPackagesMap } from "./helpers/buildPackagesMap.ts";
export { collectDependents } from "./helpers/collectDependents.ts";
export { readVersionsSnapshot, versionsSnapshotOf, } from "./helpers/versionsSnapshot.ts";
export { identifyResolutionFixes } from "pm-utils";
export type { ResolutionFix } from "pm-utils";
export { identifyClusterFixes } from "./identifyClusterFixes.ts";
export { writeBunLockFile } from "./helpers/writeBunLockFile.ts";
export interface WhyDuplicateOptions {
    filter?: PackageFilterOptions;
    all?: boolean;
    details?: boolean;
}
export declare function whyDuplicate({ filter: filterOptions, all, details, }: WhyDuplicateOptions): void;
export interface ListDuplicatesOptions {
    filter?: PackageFilterOptions;
    details?: boolean;
}
export declare function listDuplicates({ filter: filterOptions, details, }?: ListDuplicatesOptions): void;
export type DedupeMode = "apply" | "check" | "dry-run";
export interface FixDuplicatesOptions {
    mode?: DedupeMode;
    clusters?: boolean;
    filter?: PackageFilterOptions;
}
export declare function fixDuplicates({ mode, clusters, filter, }?: FixDuplicatesOptions): void;
//# sourceMappingURL=index.d.ts.map