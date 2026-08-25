import type { ClusterFix } from "pm-utils";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";
export interface DisplayManyOptions {
    title: "duplicates" | "matches";
    duplicatesPackagesMap: PackagesMap;
    dependents: DependentRangesMap;
    totalDependencies: number;
    clusterFixes?: ClusterFix[];
    color?: boolean;
    log?: (message?: string) => void;
}
export declare const displayMany: (options: DisplayManyOptions) => void;
//# sourceMappingURL=displayMany.d.ts.map