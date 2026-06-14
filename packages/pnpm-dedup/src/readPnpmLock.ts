import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { PnpmLockFile } from "./pnpmLockTypes.ts";

export const readPnpmLock = (filepath = "pnpm-lock.yaml"): PnpmLockFile => {
  return parse(readFileSync(filepath, "utf8")) as PnpmLockFile;
};
