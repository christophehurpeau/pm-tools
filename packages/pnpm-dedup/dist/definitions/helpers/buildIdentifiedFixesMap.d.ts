import { identifyResolutionFixes } from "../identifyResolutionFixes.ts";
import type { PackagesMap } from "./buildPnpmPackagesMap.ts";
import type { DependentsMap } from "./collectPnpmDependents.ts";
export declare function buildIdentifiedFixesMap(duplicatesPackagesMap: PackagesMap, dependents: DependentsMap): Map<string, ReturnType<typeof identifyResolutionFixes>>;
//# sourceMappingURL=buildIdentifiedFixesMap.d.ts.map