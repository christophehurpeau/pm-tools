import type { PackageResolution } from "./helpers/buildPnpmPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectPnpmDependents.ts";
export interface ResolutionFix {
    megeableResolutions: string[];
    to: string;
}
export declare function identifyResolutionFixes(resolutions: PackageResolution[], dependents: DependentsMap): ResolutionFix[];
//# sourceMappingURL=identifyResolutionFixes.d.ts.map