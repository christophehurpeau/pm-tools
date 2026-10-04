import { buildVersionsSnapshot } from "pm-dedup-core";
import type { VersionsSnapshot } from "pm-dedup-core";
import { readAndParseYarnLock } from "../readYarnLock.ts";
import { parseYarnLockPackages } from "./parseYarnLockPackages.ts";
import type { YarnLockPackages } from "./parseYarnLockPackages.ts";

export const versionsSnapshotOf = (
  packages: YarnLockPackages,
): VersionsSnapshot => buildVersionsSnapshot(packages.values());

export const readVersionsSnapshot = (lockPath: string): VersionsSnapshot =>
  versionsSnapshotOf(parseYarnLockPackages(readAndParseYarnLock(lockPath)));
