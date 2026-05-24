import type { BunLockFile } from "bun";
import { writeFileSync } from "node:fs";

export const writeBunLockFile = (
  bunLockResult: BunLockFile & { packages?: Record<string, any> },
  filepath = "bun.lock",
): void => {
  writeFileSync(filepath, `${JSON.stringify(bunLockResult, null, 2)}\n`);
};
