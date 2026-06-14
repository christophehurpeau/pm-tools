import { readFileSync } from "node:fs";
import JSON5 from "json5";
export const readAndParseBunLock = (filepath = "bun.lock") => {
    return JSON5.parse(readFileSync(filepath, "utf8"));
};
//# sourceMappingURL=readAndParseBunLock.js.map