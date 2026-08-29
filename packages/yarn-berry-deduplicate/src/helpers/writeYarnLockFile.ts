import { readFileSync, writeFileSync } from "node:fs";
import { stringifyYarnLock } from "./syml.ts";
import type { YarnEntries } from "./syml.ts";

const usesCrlf = (content: string): boolean =>
  /\r?\n/u.exec(content)?.[0] === "\r\n";

export const writeYarnLockFile = (
  entries: YarnEntries,
  filepath: string,
): void => {
  const content = stringifyYarnLock(entries);
  const existing = ((): string => {
    try {
      return readFileSync(filepath, "utf8");
    } catch {
      return "";
    }
  })();

  writeFileSync(
    filepath,
    usesCrlf(existing) ? content.replaceAll("\n", "\r\n") : content,
  );
};
