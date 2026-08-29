import type { BunLockFile } from "bun";
import type { ResolutionFix } from "pm-utils";
export interface ApplyFixesResult {
    changed: boolean;
    changedKeys: string[];
}
export declare function applyIdentifiedFixesToBunLock(bunLockResult: BunLockFile & {
    packages: Record<string, any>;
}, identifiedFixesMap: Map<string, ResolutionFix[]>): ApplyFixesResult;
//# sourceMappingURL=applyIdentifiedFixesToBunLock.d.ts.map