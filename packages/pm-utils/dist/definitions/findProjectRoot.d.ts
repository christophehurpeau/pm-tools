export interface ProjectRootOptions {
    lockfileName: string;
    cwd?: string;
}
/**
 * The nearest directory holding the lockfile, starting at `cwd` and walking up
 * to the filesystem root; null when there is none.
 *
 * Nearest wins, which is the rule every package manager applies: a nested
 * project carrying its own lockfile keeps resolving to itself rather than to the
 * workspace above it.
 */
export declare const findProjectRoot: ({ lockfileName, cwd, }: ProjectRootOptions) => string | null;
/**
 * `findProjectRoot` for a bin: the project root the run operates on, whatever
 * subdirectory it was invoked from.
 *
 * Returns null when there is no project to work on — as `parseBinArgs` does, the
 * reason is printed and the exit code already says so, leaving the caller
 * nothing to do but return.
 *
 * The notice goes to stderr, and only when the root is not `cwd` — a run from
 * the root prints exactly what it always did, and a redirected report stays
 * parseable.
 */
export declare const resolveProjectDir: ({ lockfileName, cwd, }: ProjectRootOptions) => string | null;
//# sourceMappingURL=findProjectRoot.d.ts.map