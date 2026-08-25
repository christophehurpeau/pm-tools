import { readFileSync, rmSync, writeFileSync } from "node:fs";

export interface FileSnapshot {
  path: string;
  // undefined when the file did not exist: restoring deletes it again
  content: string | undefined;
}

const readIfExists = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

export const captureFiles = (paths: string[]): FileSnapshot[] =>
  paths.map((path) => ({ path, content: readIfExists(path) }));

export const restoreFiles = (snapshots: FileSnapshot[]): void => {
  for (const { path, content } of snapshots) {
    if (content === undefined) {
      rmSync(path, { force: true });
    } else {
      writeFileSync(path, content);
    }
  }
};
