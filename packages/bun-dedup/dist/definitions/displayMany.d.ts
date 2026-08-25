import type { ClusterFix } from "pm-utils";
import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectDependents.ts";
import type { ResolutionFix } from "./identifyResolutionFixes.ts";
export interface DisplayManyOptions {
    title: "duplicates" | "matches";
    duplicatesPackagesMap: PackagesMap;
    dependents: DependentsMap;
    totalDependencies: number;
    identifiedFixesMap?: Map<string, ResolutionFix[]>;
    clusterFixes?: ClusterFix[];
    color?: boolean;
    log?: (message?: string) => void;
}
export declare const displayMany: (options: DisplayManyOptions) => void;
//# sourceMappingURL=displayMany.d.ts.map