import { readAndParseYarnLock } from "../readYarnLock.js";
import { buildYarnPackagesMap, filterDuplicatesYarnPackagesMap, } from "./buildYarnPackagesMap.js";
import { parseYarnLockPackages } from "./parseYarnLockPackages.js";
export const readDuplicateSnapshot = (lockPath) => new Set(Object.values(filterDuplicatesYarnPackagesMap(buildYarnPackagesMap(parseYarnLockPackages(readAndParseYarnLock(lockPath))))).flatMap((resolutions) => resolutions.map((resolution) => resolution.resolution)));
//# sourceMappingURL=duplicateSnapshot.js.map