import { join } from "node:path";
import { resolveProjectDir } from "pm-utils";
const lockfileName = "bun.lock";
export const lockPathOf = (projectDir) => join(projectDir, lockfileName);
// The project the run operates on, found by walking up from the working
// directory, so the bins work from any subdirectory of it. Null when no bun.lock
// was found: the reason is printed and the exit code set, as `parseBinArgs` does.
export const resolveBunProjectDir = () => resolveProjectDir({ lockfileName });
//# sourceMappingURL=projectDir.js.map