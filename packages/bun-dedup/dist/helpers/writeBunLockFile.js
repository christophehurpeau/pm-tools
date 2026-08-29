import { writeFileSync } from "node:fs";
export const writeBunLockFile = (bunLockResult, filepath) => {
    writeFileSync(filepath, `${JSON.stringify(bunLockResult, null, 2)}\n`);
};
//# sourceMappingURL=writeBunLockFile.js.map