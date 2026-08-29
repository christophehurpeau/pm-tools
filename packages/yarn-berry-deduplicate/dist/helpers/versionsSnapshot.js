import { buildVersionsSnapshot } from "pm-utils";
import { readAndParseYarnLock } from "../readYarnLock.js";
import { parseYarnLockPackages } from "./parseYarnLockPackages.js";
export const versionsSnapshotOf = (packages) => buildVersionsSnapshot(packages.values());
export const readVersionsSnapshot = (lockPath) => versionsSnapshotOf(parseYarnLockPackages(readAndParseYarnLock(lockPath)));
//# sourceMappingURL=versionsSnapshot.js.map