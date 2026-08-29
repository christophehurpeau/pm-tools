import { buildVersionsSnapshot } from "pm-utils";
import type { VersionsSnapshot } from "pm-utils";
import { readPnpmLock } from "../readPnpmLock.ts";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.ts";

export const readVersionsSnapshot = (lockPath: string): VersionsSnapshot =>
  buildVersionsSnapshot(
    parsePnpmLockPackages(readPnpmLock(lockPath)).packages.values(),
  );
