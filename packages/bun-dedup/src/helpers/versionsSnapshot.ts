import { buildVersionsSnapshot } from "pm-dedup-core";
import type { VersionsSnapshot } from "pm-dedup-core";
import { readAndParseBunLock } from "../readAndParseBunLock.ts";
import { parseBunLockPackages } from "./parseBunLockPackages.ts";
import type { BunLockPackages } from "./parseBunLockPackages.ts";

export const versionsSnapshotOf = (
  packages: BunLockPackages,
): VersionsSnapshot => buildVersionsSnapshot(packages.values());

export const readVersionsSnapshot = (lockPath: string): VersionsSnapshot =>
  versionsSnapshotOf(parseBunLockPackages(readAndParseBunLock(lockPath)));
