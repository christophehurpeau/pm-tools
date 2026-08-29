import type { PackageFilterOptions } from "pm-utils";
export { dedupe } from "./dedupe.ts";
export { applyClusterFixes } from "./applyClusterFixes.ts";
export { identifyClusterFixes } from "./identifyClusterFixes.ts";
export { toLockstepGraph } from "./helpers/toLockstepGraph.ts";
export { displayMany } from "./displayMany.ts";
export { readPnpmLock } from "./readPnpmLock.ts";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
export { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.ts";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
export { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
export { readVersionsSnapshot } from "./helpers/versionsSnapshot.ts";
export { createManifestReader, createManifestReaderWithStats, } from "./helpers/readInstalledManifest.ts";
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
//# sourceMappingURL=index.d.ts.map