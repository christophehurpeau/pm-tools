import { readFileSync, rmSync, writeFileSync } from "node:fs";
const readIfExists = (path) => {
    try {
        return readFileSync(path, "utf8");
    }
    catch {
        return undefined;
    }
};
export const captureFiles = (paths) => paths.map((path) => ({ path, content: readIfExists(path) }));
export const restoreFiles = (snapshots) => {
    for (const { path, content } of snapshots) {
        if (content === undefined) {
            rmSync(path, { force: true });
        }
        else {
            writeFileSync(path, content);
        }
    }
};
//# sourceMappingURL=fileSnapshot.js.map