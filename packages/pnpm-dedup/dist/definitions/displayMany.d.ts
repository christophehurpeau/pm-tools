import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectPnpmDependents.ts";
import type { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
export declare const displayMany: (title: "duplicates" | "matches", duplicatesPackagesMap: PackagesMap, dependents: DependentsMap, identifiedFixesMap?: Map<string, ReturnType<typeof identifyResolutionFixes>>, log?: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
}) => void;
//# sourceMappingURL=displayMany.d.ts.map