import { readFileSync, writeFileSync } from "node:fs";
import { stringifyYarnLock } from "./syml.js";
const usesCrlf = (content) => /\r?\n/u.exec(content)?.[0] === "\r\n";
export const writeYarnLockFile = (entries, filepath) => {
    const content = stringifyYarnLock(entries);
    const existing = (() => {
        try {
            return readFileSync(filepath, "utf8");
        }
        catch {
            return "";
        }
    })();
    writeFileSync(filepath, usesCrlf(existing) ? content.replaceAll("\n", "\r\n") : content);
};
//# sourceMappingURL=writeYarnLockFile.js.map