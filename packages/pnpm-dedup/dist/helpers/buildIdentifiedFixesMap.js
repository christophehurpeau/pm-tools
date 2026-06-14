import { identifyResolutionFixes } from "../identifyResolutionFixes.js";
export function buildIdentifiedFixesMap(duplicatesPackagesMap, dependents) {
    return new Map(Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => [
        packageName,
        identifyResolutionFixes(resolutions, dependents),
    ]));
}
//# sourceMappingURL=buildIdentifiedFixesMap.js.map