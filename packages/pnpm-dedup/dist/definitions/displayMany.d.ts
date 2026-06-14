import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectPnpmDependents.ts";
import type { DevDependencyFixesMap } from "./helpers/identifyDevDependencyFixes.ts";
export declare const displayMany: (title: "duplicates" | "matches", duplicatesPackagesMap: PackagesMap, dependents: DependentsMap, devDependencyFixes?: DevDependencyFixesMap, log?: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
}) => void;
//# sourceMappingURL=displayMany.d.ts.map