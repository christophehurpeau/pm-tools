import { buildVersionsSnapshot } from "pm-dedup-core";
import type { VersionsSnapshot } from "pm-dedup-core";
import { readPnpmLock } from "../readPnpmLock.ts";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.ts";

export const readVersionsSnapshot = (lockPath: string): VersionsSnapshot =>
  buildVersionsSnapshot(
    parsePnpmLockPackages(readPnpmLock(lockPath)).packages.values(),
  );
