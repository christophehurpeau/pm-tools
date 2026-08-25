import { readPnpmLock } from "../readPnpmLock.js";
import { buildPnpmPackagesMap, filterDuplicatesPnpmPackagesMap, } from "./buildPnpmPackagesMap.js";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.js";
export const readDuplicateSnapshot = (lockPath) => new Set(Object.values(filterDuplicatesPnpmPackagesMap(buildPnpmPackagesMap(parsePnpmLockPackages(readPnpmLock(lockPath))))).flatMap((resolutions) => resolutions.map((resolution) => resolution.resolution)));
//# sourceMappingURL=duplicateSnapshot.js.map