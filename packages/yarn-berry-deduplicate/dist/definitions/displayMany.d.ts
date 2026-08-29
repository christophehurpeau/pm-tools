import type { ClusterFix, DuplicatesReportTitle, ResolutionFix } from "pm-utils";
import type { PackagesMap } from "./helpers/buildYarnPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectYarnDependents.ts";
export interface DisplayManyOptions {
    title: DuplicatesReportTitle;
    notice?: string;
    duplicatesPackagesMap: PackagesMap;
    dependents: DependentsMap;
    totalDependencies: number;
    identifiedFixesMap?: Map<string, ResolutionFix[]>;
    clusterFixes?: ClusterFix[];
    details?: boolean;
    color?: boolean;
    log?: (message?: string) => void;
}
export declare const displayMany: (options: DisplayManyOptions) => void;
//# sourceMappingURL=displayMany.d.ts.map