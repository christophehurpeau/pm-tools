import ciInfo from "ci-info";
import type { PnpmRunner } from "./runPnpm.ts";
import { runPnpm } from "./runPnpm.ts";

export interface PnpmLockfileIsFrozenOptions {
  projectDir: string;
  run?: PnpmRunner;
  isCI?: boolean;
}

const readConfig = (
  run: PnpmRunner,
  projectDir: string,
  key: string,
): unknown => {
  const { status, output } = run(["config", "get", key, "--json"], {
    cwd: projectDir,
    stdio: "pipe",
  });
  if (status !== 0) return undefined;
  try {
    return JSON.parse(output.split("\n", 1)[0] ?? "") as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Whether `pnpm install` refuses to write the lockfile here. pnpm computes the
 * CI default inside the install command, so `pnpm config get` reports only an
 * explicit setting: a `frozen-lockfile` from `.npmrc`, `pnpm-workspace.yaml` or
 * `pnpm_config_frozen_lockfile` wins, and otherwise it is frozen on CI — as
 * `ci-info`, which pnpm uses, detects it — unless `prefer-frozen-lockfile` is
 * false. `pnpm dedupe` itself writes regardless, which is why this has to be
 * asked rather than left to the package manager.
 *
 * False when pnpm cannot be run: there is no install to honor.
 */
export const pnpmLockfileIsFrozen = ({
  projectDir,
  run = runPnpm,
  isCI = ciInfo.isCI,
}: PnpmLockfileIsFrozenOptions): boolean => {
  try {
    const frozen = readConfig(run, projectDir, "frozen-lockfile");
    if (typeof frozen === "boolean") return frozen;
    return (
      isCI && readConfig(run, projectDir, "prefer-frozen-lockfile") !== false
    );
  } catch {
    return false;
  }
};
