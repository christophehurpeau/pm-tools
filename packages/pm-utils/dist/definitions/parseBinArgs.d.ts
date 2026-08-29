import { parseArgs } from "node:util";
type ParseArgsConfig = NonNullable<Parameters<typeof parseArgs>[0]>;
/**
 * `parseArgs` with the two things a bin still has to do itself: answer
 * `--help`, and turn an unknown flag into a readable line instead of a stack
 * trace. Rejecting the unknown flag matters more than it reads: a mistyped
 * `--dry-run` silently ignored is a run that applies its changes.
 *
 * Returns null when the bin has nothing left to do — the usage was asked for,
 * or the arguments were rejected and the exit code already says so.
 */
export declare const parseBinArgs: <T extends ParseArgsConfig>(usage: string, config: T) => ReturnType<typeof parseArgs<T>> | null;
export {};
//# sourceMappingURL=parseBinArgs.d.ts.map