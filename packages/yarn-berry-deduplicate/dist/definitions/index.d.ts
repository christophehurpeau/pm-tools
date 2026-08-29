import type { PackageFilterOptions } from "pm-utils";
export { displayMany } from "./displayMany.ts";
export { applyClusterFixes } from "./applyClusterFixes.ts";
export { identifyClusterFixes } from "./identifyClusterFixes.ts";
export { readAndParseYarnLock } from "./readYarnLock.ts";
export { parseYarnLock, stringifyYarnLock } from "./helpers/syml.ts";
export type { YarnEntries, YarnEntry } from "./helpers/syml.ts";
export { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.ts";
export type { YarnLockPackages, YarnNpmPackage, YarnOtherPackage, YarnPackage, } from "./helpers/parseYarnLockPackages.ts";
export { buildYarnPackagesMap, filterDuplicatesYarnPackagesMap, } from "./helpers/buildYarnPackagesMap.ts";
export type { PackageResolution, PackagesMap, } from "./helpers/buildYarnPackagesMap.ts";
export { collectWorkspaces, createManifestReader, } from "./helpers/collectWorkspaces.ts";
export type { ManifestReader, Workspace } from "./helpers/collectWorkspaces.ts";
export { collectYarnDependents } from "./helpers/collectYarnDependents.ts";
export type { Dependent, DependentsMap, } from "./helpers/collectYarnDependents.ts";
export { toLockstepGraph } from "./helpers/toLockstepGraph.ts";
export { readVersionsSnapshot, versionsSnapshotOf, } from "./helpers/versionsSnapshot.ts";
export { applyIdentifiedFixesToYarnLock } from "./helpers/applyIdentifiedFixesToYarnLock.ts";
export { writeYarnLockFile } from "./helpers/writeYarnLockFile.ts";
export { identifyResolutionFixes } from "pm-utils";
export type { ResolutionFix } from "pm-utils";
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