import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectDependents.ts";
import type { identifyResolutionFixes } from "./index.ts";
export declare const displayMany: (title: "duplicates" | "matches", duplicatesPackagesMap: PackagesMap, dependents: DependentsMap, identifiedFixesMap?: Map<string, ReturnType<typeof identifyResolutionFixes>>, log?: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
}) => void;
//# sourceMappingURL=displayMany.d.ts.map