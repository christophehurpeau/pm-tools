import type { YarnEntries } from "./helpers/syml.ts";
/**
 * A yarn classic lockfile parses without complaint and yields nothing this tool
 * understands: no `__metadata`, and keys carrying no protocol. Corepack answers
 * a bare `yarn` with 1.x in any project that pins no `packageManager`, so this
 * is a lockfile a user can very plausibly be standing in front of — say which
 * format was found rather than reporting no duplicates at all.
 */
export declare const readAndParseYarnLock: (filepath: string) => YarnEntries;
//# sourceMappingURL=readYarnLock.d.ts.map