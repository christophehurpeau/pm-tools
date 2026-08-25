import { spawnSync } from "node:child_process";

export interface BunRunResult {
  status: number | null;
  output: string;
}

export interface RunBunOptions {
  cwd?: string;
  // inherit to stream bun's own reporter, pipe to capture it
  stdio?: "inherit" | "pipe";
}

export type BunRunner = (
  args: string[],
  options?: RunBunOptions,
) => BunRunResult;

export const runBun: BunRunner = (args, { cwd, stdio = "inherit" } = {}) => {
  const result = spawnSync("bun", args, {
    cwd,
    stdio,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    output: stdio === "pipe" ? `${result.stdout}\n${result.stderr}` : "",
  };
};
