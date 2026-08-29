import { spawnSync } from "node:child_process";
export const runYarn = (args, { cwd, stdio = "inherit" } = {}) => {
    const result = spawnSync("yarn", args, { cwd, stdio, encoding: "utf8" });
    if (result.error) {
        throw result.error;
    }
    return {
        status: result.status,
        output: stdio === "pipe" ? `${result.stdout}\n${result.stderr}` : "",
    };
};
//# sourceMappingURL=runYarn.js.map