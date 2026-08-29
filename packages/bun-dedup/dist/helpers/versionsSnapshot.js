import { buildVersionsSnapshot } from "pm-utils";
import { readAndParseBunLock } from "../readAndParseBunLock.js";
import { parseBunLockPackages } from "./parseBunLockPackages.js";
export const versionsSnapshotOf = (packages) => buildVersionsSnapshot(packages.values());
export const readVersionsSnapshot = (lockPath) => versionsSnapshotOf(parseBunLockPackages(readAndParseBunLock(lockPath)));
//# sourceMappingURL=versionsSnapshot.js.map