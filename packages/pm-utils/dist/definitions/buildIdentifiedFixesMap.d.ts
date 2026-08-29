import { type ResolutionDependent, type ResolutionDependentsMap, type ResolutionEntry, type ResolutionFix } from "./identifyResolutionFixes.ts";
export type ResolutionsMap = Record<string, ResolutionEntry[]>;
export declare const buildIdentifiedFixesMap: <D extends ResolutionDependent>(duplicatesResolutionsMap: ResolutionsMap, dependents: ResolutionDependentsMap<D>) => Map<string, ResolutionFix[]>;
//# sourceMappingURL=buildIdentifiedFixesMap.d.ts.map