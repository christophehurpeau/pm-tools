import { spawnSync } from "node:child_process";
export const runBun = (args, { cwd, stdio = "inherit" } = {}) => {
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
//# sourceMappingURL=runBun.js.map