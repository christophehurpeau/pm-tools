import { readFileSync } from "node:fs";
import { parse } from "yaml";
export const readPnpmLock = (filepath) => {
    return parse(readFileSync(filepath, "utf8"));
};
//# sourceMappingURL=readPnpmLock.js.map