export interface ResolutionPackage {
    type: string;
    name: string;
}
export interface NpmResolutionPackage extends ResolutionPackage {
    type: "npm";
    version: string;
}
export interface ResolutionEntry<P extends ResolutionPackage = ResolutionPackage> {
    resolution: string;
    package: P;
}
export interface ResolutionDependent {
    version: string;
    nonSemver?: boolean;
}
export type ResolutionDependentsMap<D extends ResolutionDependent = ResolutionDependent> = Map<string, D[]>;
export interface ResolutionFix {
    mergeableResolutions: string[];
    to: string;
}
/**
 * Dedupe opportunities reachable one package at a time. A family of co-versioned
 * packages whose duplicate survives only because a few members resolve high is
 * invisible here and is handled by `identifyLockstepClusterFixes`.
 */
export declare const identifyResolutionFixes: <D extends ResolutionDependent>(resolutions: ResolutionEntry[], dependents: ResolutionDependentsMap<D>) => ResolutionFix[];
//# sourceMappingURL=identifyResolutionFixes.d.ts.map