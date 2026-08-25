import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
export interface DuplicateResolutionView {
    resolution: string;
    installations: string[];
}
export interface DuplicateDependentView {
    requester: string;
    range: string;
    resolvedVersion?: string;
}
export interface DuplicateDedupeView {
    from: string[];
    to: string;
    direction?: ClusterFix["direction"];
}
export interface DuplicatePackageView {
    packageName: string;
    resolutions: DuplicateResolutionView[];
    dependents: DuplicateDependentView[];
    dedupe: DuplicateDedupeView[];
}
export interface DuplicatesReportOptions {
    title: "duplicates" | "matches";
    packages: DuplicatePackageView[];
    totalDependencies: number;
    clusterFixes?: ClusterFix[];
    dedupeCommand: string;
    color?: boolean;
    log?: (message?: string) => void;
}
export declare const renderDuplicatesReport: ({ title, packages, totalDependencies, clusterFixes, dedupeCommand, color: colorEnabled, log, }: DuplicatesReportOptions) => void;
//# sourceMappingURL=renderDuplicatesReport.d.ts.map