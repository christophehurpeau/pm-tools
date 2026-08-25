import type { DuplicateSnapshot } from "pm-utils";
import { readPnpmLock } from "../readPnpmLock.ts";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./buildPnpmPackagesMap.ts";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.ts";

export const readDuplicateSnapshot = (lockPath: string): DuplicateSnapshot =>
  new Set(
    Object.values(
      filterDuplicatesPnpmPackagesMap(
        buildPnpmPackagesMap(parsePnpmLockPackages(readPnpmLock(lockPath))),
      ),
    ).flatMap((resolutions) =>
      resolutions.map((resolution) => resolution.resolution),
    ),
  );
