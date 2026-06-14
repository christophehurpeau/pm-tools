export { dedupe } from "./dedupe.ts";
export { displayMany } from "./displayMany.ts";
export { readPnpmLock } from "./readPnpmLock.ts";
export { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
export { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./helpers/buildPnpmPackagesMap.ts";
export { collectPnpmDependents } from "./helpers/collectPnpmDependents.ts";
export { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
export { identifyDevDependencyFixes } from "./helpers/identifyDevDependencyFixes.ts";
export { createManifestReader } from "./helpers/readInstalledManifest.ts";
export declare function whyDuplicate(packageNameToFilter: string, all: boolean): void;
export declare function listDuplicates(): void;
//# sourceMappingURL=index.d.ts.map