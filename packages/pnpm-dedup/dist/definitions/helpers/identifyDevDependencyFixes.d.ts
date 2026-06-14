import type { PackagesMap } from "./buildPnpmPackagesMap.ts";
import type { DependentRangesMap } from "./collectDependentRanges.ts";
export interface DevDependencyFix {
    name: string;
    version: string;
}
export type DevDependencyFixesMap = Map<string, DevDependencyFix>;
/**
 * For each duplicated package, find the highest installed version that
 * satisfies every dependent's declared range. When such a version exists,
 * adding it as a root devDependency lets pnpm collapse the duplicates onto it.
 * When no single version covers all dependents, no safe single-add exists and
 * the package is skipped.
 */
export declare const identifyDevDependencyFixes: (duplicatesPackagesMap: PackagesMap, dependentRanges: DependentRangesMap) => DevDependencyFixesMap;
//# sourceMappingURL=identifyDevDependencyFixes.d.ts.map