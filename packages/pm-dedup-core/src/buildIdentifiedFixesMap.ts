import {
  type ResolutionDependent,
  type ResolutionDependentsMap,
  type ResolutionEntry,
  type ResolutionFix,
  identifyResolutionFixes,
} from "./identifyResolutionFixes.ts";

export type ResolutionsMap = Record<string, ResolutionEntry[]>;

export const buildIdentifiedFixesMap = <D extends ResolutionDependent>(
  duplicatesResolutionsMap: ResolutionsMap,
  dependents: ResolutionDependentsMap<D>,
): Map<string, ResolutionFix[]> =>
  new Map<string, ResolutionFix[]>(
    Object.entries(duplicatesResolutionsMap).map(
      ([packageName, resolutions]) => [
        packageName,
        identifyResolutionFixes(resolutions, dependents),
      ],
    ),
  );
