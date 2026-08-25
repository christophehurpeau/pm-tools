import type { DuplicateSnapshot } from "pm-utils";
import { readAndParseBunLock } from "../readAndParseBunLock.ts";
import {
  buildPackagesMap,
  filterDuplicatesPackagesMap,
} from "./buildPackagesMap.ts";
import { parseBunLockPackages } from "./parseBunLockPackages.ts";

export const readDuplicateSnapshot = (lockPath: string): DuplicateSnapshot =>
  new Set(
    Object.values(
      filterDuplicatesPackagesMap(
        buildPackagesMap(parseBunLockPackages(readAndParseBunLock(lockPath))),
      ),
    ).flatMap((resolutions) =>
      resolutions.map((resolution) => resolution.resolution),
    ),
  );
