export { displayMany } from "./displayMany.ts";
export { readAndParseBunLock } from "./readAndParseBunLock.ts";
export { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
export { buildPackagesMap } from "./helpers/buildPackagesMap.ts";
export { collectDependents } from "./helpers/collectDependents.ts";
export { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
export { writeBunLockFile } from "./helpers/writeBunLockFile.ts";
export declare function whyDuplicate(packageNameToFilter: string, all: boolean): void;
export declare function listDuplicates(): void;
export declare function fixDuplicates(dryRun?: boolean): void;
//# sourceMappingURL=index.d.ts.map