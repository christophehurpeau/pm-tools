import { join } from "node:path";
import { resolveProjectDir } from "pm-utils";

const lockfileName = "yarn.lock";

export const lockPathOf = (projectDir: string): string =>
  join(projectDir, lockfileName);

// The project the run operates on, found by walking up from the working
// directory, so the bins work from any subdirectory of it. Null when no
// yarn.lock was found: the reason is printed and the exit code set, as
// `parseBinArgs` does.
export const resolveYarnProjectDir = (): string | null =>
  resolveProjectDir({ lockfileName });
