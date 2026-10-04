import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createColorize, shouldColorize } from "./reportColors.ts";

export interface ProjectRootOptions {
  lockfileName: string;
  cwd?: string;
}

/**
 * The nearest directory holding the lockfile, starting at `cwd` and walking up
 * to the filesystem root; null when there is none.
 *
 * Nearest wins, which is the rule every package manager applies: a nested
 * project carrying its own lockfile keeps resolving to itself rather than to the
 * workspace above it.
 */
export const findProjectRoot = ({
  lockfileName,
  cwd = process.cwd(),
}: ProjectRootOptions): string | null => {
  let dir = cwd;
  for (;;) {
    if (existsSync(join(dir, lockfileName))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

/**
 * `findProjectRoot` for a bin: the project root the run operates on, whatever
 * subdirectory it was invoked from.
 *
 * Returns null when there is no project to work on — as `parseBinArgs` does, the
 * reason is printed and the exit code already says so, leaving the caller
 * nothing to do but return.
 *
 * The notice goes to stderr, and only when the root is not `cwd` — a run from
 * the root prints exactly what it always did, and a redirected report stays
 * parseable.
 */
export const resolveProjectDir = ({
  lockfileName,
  cwd = process.cwd(),
}: ProjectRootOptions): string | null => {
  const projectDir = findProjectRoot({ lockfileName, cwd });

  if (projectDir === null) {
    console.error(`No ${lockfileName} found in ${cwd} or any parent directory`);
    process.exitCode = 1;
    return null;
  }

  if (projectDir !== cwd) {
    const colorize = createColorize(shouldColorize(process.stderr));
    console.error(colorize("dim", `using ${join(projectDir, lockfileName)}`));
  }

  return projectDir;
};
