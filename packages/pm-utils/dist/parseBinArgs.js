import { parseArgs } from "node:util";
/**
 * `parseArgs` with the two things a bin still has to do itself: answer
 * `--help`, and turn an unknown flag into a readable line instead of a stack
 * trace. Rejecting the unknown flag matters more than it reads: a mistyped
 * `--dry-run` silently ignored is a run that applies its changes.
 *
 * Returns null when the bin has nothing left to do — the usage was asked for,
 * or the arguments were rejected and the exit code already says so.
 */
export const parseBinArgs = (usage, config) => {
    const args = config.args ?? process.argv.slice(2);
    if (args.includes("--help") || args.includes("-h")) {
        console.log(usage);
        return null;
    }
    try {
        return parseArgs(config);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        console.error();
        console.error(usage);
        process.exitCode = 1;
        return null;
    }
};
//# sourceMappingURL=parseBinArgs.js.map