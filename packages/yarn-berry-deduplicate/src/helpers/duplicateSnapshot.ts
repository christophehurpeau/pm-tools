import type { DuplicateSnapshot } from "pm-utils";
import { readAndParseYarnLock } from "../readYarnLock.ts";
import {
  buildYarnPackagesMap,
  filterDuplicatesYarnPackagesMap,
} from "./buildYarnPackagesMap.ts";
import { parseYarnLockPackages } from "./parseYarnLockPackages.ts";

export const readDuplicateSnapshot = (lockPath: string): DuplicateSnapshot =>
  new Set(
    Object.values(
      filterDuplicatesYarnPackagesMap(
        buildYarnPackagesMap(
          parseYarnLockPackages(readAndParseYarnLock(lockPath)),
        ),
      ),
    ).flatMap((resolutions) =>
      resolutions.map((resolution) => resolution.resolution),
    ),
  );
