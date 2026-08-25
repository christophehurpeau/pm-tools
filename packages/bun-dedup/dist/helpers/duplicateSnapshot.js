import { readAndParseBunLock } from "../readAndParseBunLock.js";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./buildPackagesMap.js";
import { parseBunLockPackages } from "./parseBunLockPackages.js";
export const readDuplicateSnapshot = (lockPath) => new Set(Object.values(filterDuplicatesPackagesMap(buildPackagesMap(parseBunLockPackages(readAndParseBunLock(lockPath))))).flatMap((resolutions) => resolutions.map((resolution) => resolution.resolution)));
//# sourceMappingURL=duplicateSnapshot.js.map