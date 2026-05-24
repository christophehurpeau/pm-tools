import { identifyResolutionFixes } from "../identifyResolutionFixes.ts";
import type { PackagesMap } from "./buildPackagesMap.ts";
import type { DependentsMap } from "./collectDependents.ts";
export declare function buildIdentifiedFixesMap(duplicatesPackagesMap: PackagesMap, dependents: DependentsMap): Map<string, ReturnType<typeof identifyResolutionFixes>>;
//# sourceMappingURL=buildIdentifiedFixesMap.d.ts.map