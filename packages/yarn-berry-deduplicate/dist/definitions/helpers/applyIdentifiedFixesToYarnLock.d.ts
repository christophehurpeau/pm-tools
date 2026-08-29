import type { ResolutionFix } from "pm-utils";
import type { YarnEntries } from "./syml.ts";
export interface ApplyFixesResult {
    changed: boolean;
    changedKeys: string[];
}
export interface ApplyFixesToYarnLockResult {
    entries: YarnEntries;
    result: ApplyFixesResult;
}
/**
 * Regroup the descriptors a fix merges under the entry it merges into.
 *
 * A yarn.lock key *is* the descriptor a requester declared, and that is how
 * yarn matches a dependency to an entry — so the descriptors are carried over
 * untouched and only the entry they sit under changes. Rewriting one to name
 * the target version instead would leave the range it replaced unlisted, and
 * yarn would resolve that range afresh and undo the merge.
 *
 * The lockfile that comes out asks for the merge; `yarn install` is what
 * performs it, and rewrites the checksums and nested trees this pass leaves
 * alone.
 */
export declare const applyIdentifiedFixesToYarnLock: (entries: YarnEntries, identifiedFixesMap: Map<string, ResolutionFix[]>) => ApplyFixesToYarnLockResult;
//# sourceMappingURL=applyIdentifiedFixesToYarnLock.d.ts.map