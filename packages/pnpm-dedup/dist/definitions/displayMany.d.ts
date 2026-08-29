import type { ClusterFix, DuplicatesReportTitle } from "pm-utils";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";
export interface DisplayManyOptions {
    title: DuplicatesReportTitle;
    notice?: string;
    duplicatesPackagesMap: PackagesMap;
    dependents: DependentRangesMap;
    totalDependencies: number;
    clusterFixes?: ClusterFix[];
    details?: boolean;
    color?: boolean;
    log?: (message?: string) => void;
}
export declare const displayMany: (options: DisplayManyOptions) => void;
//# sourceMappingURL=displayMany.d.ts.map