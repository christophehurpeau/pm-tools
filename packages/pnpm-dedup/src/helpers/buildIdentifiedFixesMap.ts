import { identifyResolutionFixes } from "../identifyResolutionFixes.ts";
import type { PackagesMap } from "./buildPnpmPackagesMap.ts";
import type { DependentsMap } from "./collectPnpmDependents.ts";

export function buildIdentifiedFixesMap(
  duplicatesPackagesMap: PackagesMap,
  dependents: DependentsMap,
): Map<string, ReturnType<typeof identifyResolutionFixes>> {
  return new Map<string, ReturnType<typeof identifyResolutionFixes>>(
    Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => [
      packageName,
      identifyResolutionFixes(resolutions, dependents),
    ]),
  );
}
