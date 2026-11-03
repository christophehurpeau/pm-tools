import type { YarnRunner } from "./runYarn.ts";
import { runYarn } from "./runYarn.ts";

/**
 * Whether `yarn install` refuses to touch the lockfile here, as yarn itself
 * resolves it: `enableImmutableInstalls` from `.yarnrc.yml` or
 * `YARN_ENABLE_IMMUTABLE_INSTALLS`, defaulting to true on CI. An
 * `--immutable` passed on the command line of an outer install never reaches a
 * lifecycle script, so it cannot be seen from here.
 *
 * False when yarn cannot be run: there is no install to honor.
 */
export const yarnInstallsAreImmutable = (
  projectDir: string,
  run: YarnRunner = runYarn,
): boolean => {
  try {
    const { status, output } = run(
      ["config", "get", "enableImmutableInstalls", "--json"],
      { cwd: projectDir, stdio: "pipe" },
    );
    return status === 0 && output.split("\n", 1)[0]?.trim() === "true";
  } catch {
    return false;
  }
};
