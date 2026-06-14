export { dedupe } from "./dedupe.ts";
export { displayMany } from "./displayMany.ts";
export { readPnpmLock } from "./readPnpmLock.ts";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
export { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.ts";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
export { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
export { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.ts";
export declare function whyDuplicate(packageNameToFilter: string, all: boolean): void;
export declare function listDuplicates(): void;
//# sourceMappingURL=index.d.ts.map