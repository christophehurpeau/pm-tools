import { spawnSync } from "node:child_process";
import { nestedRunEnv } from "pm-dedup-core";

export interface PnpmRunResult {
  status: number | null;
  output: string;
}

export interface RunPnpmOptions {
  cwd?: string;
  // inherit to stream pnpm's own reporter, pipe to capture it
  stdio?: "inherit" | "pipe";
}

export type PnpmRunner = (
  args: string[],
  options?: RunPnpmOptions,
) => PnpmRunResult;

export const runPnpm: PnpmRunner = (
  args,
  { cwd, stdio = "inherit" }: RunPnpmOptions = {},
) => {
  const result = spawnSync("pnpm", args, {
    cwd,
    stdio,
    encoding: "utf8",
    env: nestedRunEnv(),
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    output: stdio === "pipe" ? `${result.stdout}\n${result.stderr}` : "",
  };
};
