import type { PackagesMap } from "./helpers/buildPackagesMap.ts";
import type { DependentsMap } from "./helpers/collectDependents.ts";
import type { ClusterFix } from "./identifyClusterFixes.ts";
import type { ResolutionFix } from "./identifyResolutionFixes.ts";
interface DisplayManyOptions {
    title: "duplicates" | "matches";
    duplicatesPackagesMap: PackagesMap;
    dependents: DependentsMap;
    identifiedFixesMap?: Map<string, ResolutionFix[]>;
    clusterFixes?: ClusterFix[];
    log?: (message?: string) => void;
}
export declare const displayMany: ({ title, duplicatesPackagesMap, dependents, identifiedFixesMap, clusterFixes, log, }: DisplayManyOptions) => void;
export {};
//# sourceMappingURL=displayMany.d.ts.map