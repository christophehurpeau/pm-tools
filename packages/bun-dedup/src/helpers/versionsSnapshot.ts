import { buildVersionsSnapshot } from "pm-utils";
import type { VersionsSnapshot } from "pm-utils";
import { readAndParseBunLock } from "../readAndParseBunLock.ts";
import { parseBunLockPackages } from "./parseBunLockPackages.ts";
import type { BunLockPackages } from "./parseBunLockPackages.ts";

export const versionsSnapshotOf = (
  packages: BunLockPackages,
): VersionsSnapshot => buildVersionsSnapshot(packages.values());

export const readVersionsSnapshot = (lockPath: string): VersionsSnapshot =>
  versionsSnapshotOf(parseBunLockPackages(readAndParseBunLock(lockPath)));
