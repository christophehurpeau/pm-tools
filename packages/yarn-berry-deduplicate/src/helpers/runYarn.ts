import { spawnSync } from "node:child_process";

export interface YarnRunResult {
  status: number | null;
  output: string;
}

export interface RunYarnOptions {
  cwd?: string;
  // inherit to stream yarn's own reporter, pipe to capture it
  stdio?: "inherit" | "pipe";
}

export type YarnRunner = (
  args: string[],
  options?: RunYarnOptions,
) => YarnRunResult;

export const runYarn: YarnRunner = (args, { cwd, stdio = "inherit" } = {}) => {
  const result = spawnSync("yarn", args, { cwd, stdio, encoding: "utf8" });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    output: stdio === "pipe" ? `${result.stdout}\n${result.stderr}` : "",
  };
};
