import { identifyResolutionFixes, } from "./identifyResolutionFixes.js";
export const buildIdentifiedFixesMap = (duplicatesResolutionsMap, dependents) => new Map(Object.entries(duplicatesResolutionsMap).map(([packageName, resolutions]) => [
    packageName,
    identifyResolutionFixes(resolutions, dependents),
]));
//# sourceMappingURL=buildIdentifiedFixesMap.js.map