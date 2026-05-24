import type { PackageResolution } from "./helpers/buildPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectDependents.ts";
export interface ResolutionFix {
    megeableResolutions: string[];
    to: string;
}
export declare function identifyResolutionFixes(resolutions: PackageResolution[], dependents: DependentsMap): ResolutionFix[];
//# sourceMappingURL=identifyResolutionFixes.d.ts.map