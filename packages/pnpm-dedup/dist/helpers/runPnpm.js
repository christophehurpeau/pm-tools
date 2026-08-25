import { spawnSync } from "node:child_process";
export const runPnpm = (args, { cwd, stdio = "inherit" } = {}) => {
    const result = spawnSync("pnpm", args, {
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
//# sourceMappingURL=runPnpm.js.map