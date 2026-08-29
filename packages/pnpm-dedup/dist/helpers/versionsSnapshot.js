import { buildVersionsSnapshot } from "pm-utils";
import { readPnpmLock } from "../readPnpmLock.js";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.js";
export const readVersionsSnapshot = (lockPath) => buildVersionsSnapshot(parsePnpmLockPackages(readPnpmLock(lockPath)).packages.values());
//# sourceMappingURL=versionsSnapshot.js.map