import { readFileSync } from "node:fs";
import { parseYarnLock } from "./helpers/syml.ts";
import type { YarnEntries } from "./helpers/syml.ts";

/**
 * A yarn classic lockfile parses without complaint and yields nothing this tool
 * understands: no `__metadata`, and keys carrying no protocol. Corepack answers
 * a bare `yarn` with 1.x in any project that pins no `packageManager`, so this
 * is a lockfile a user can very plausibly be standing in front of — say which
 * format was found rather than reporting no duplicates at all.
 */
export const readAndParseYarnLock = (filepath: string): YarnEntries => {
  const entries = parseYarnLock(readFileSync(filepath, "utf8"));

  if (!entries.__metadata) {
    throw new Error(
      `${filepath} carries no __metadata: it is not a yarn berry lockfile. yarn classic's format is not one this tool reads.`,
    );
  }

  return entries;
};
