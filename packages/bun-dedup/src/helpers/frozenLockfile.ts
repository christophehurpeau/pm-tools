import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Env = typeof process.env;

const readFrozenLockfile = (path: string | undefined): boolean | undefined => {
  if (path === undefined || !existsSync(path)) return undefined;
  try {
    const config = Bun.TOML.parse(readFileSync(path, "utf8")) as {
      install?: { frozenLockfile?: unknown };
    };
    const value = config.install?.frozenLockfile;
    return typeof value === "boolean" ? value : undefined;
  } catch {
    return undefined;
  }
};

// One global file: with `XDG_CONFIG_HOME` set, bun never reads `~/.bunfig.toml`,
// even when the XDG directory holds none.
const globalBunfigPath = (env: Env): string | undefined => {
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, ".bunfig.toml");
  if (env.HOME) return join(env.HOME, ".bunfig.toml");
  return undefined;
};

/**
 * Whether `bun install` refuses to write the lockfile here. Bun has no CI
 * default and no environment variable for it: only `install.frozenLockfile`,
 * from the project's `bunfig.toml` (a dotted `.bunfig.toml` is not read there)
 * over the global one. A `--frozen-lockfile` passed to an outer install never
 * reaches a lifecycle script, so it cannot be seen from here.
 */
export const bunLockfileIsFrozen = (
  projectDir: string,
  env: Env = process.env,
): boolean =>
  readFrozenLockfile(join(projectDir, "bunfig.toml")) ??
  readFrozenLockfile(globalBunfigPath(env)) ??
  false;
