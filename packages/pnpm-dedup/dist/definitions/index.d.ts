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
export { createManifestReader, createManifestReaderWithStats, } from "./helpers/readInstalledManifest.ts";
export declare function whyDuplicate(packageNameToFilter: string, all: boolean): void;
export declare function listDuplicates(): void;
//# sourceMappingURL=index.d.ts.map