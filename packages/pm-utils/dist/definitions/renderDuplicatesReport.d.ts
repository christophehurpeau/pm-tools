import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
export interface DuplicateResolutionView {
    resolution: string;
    version?: string;
    installations: string[];
}
export interface DuplicateDependentView {
    requester: string;
    range: string;
    resolvedVersion?: string;
    resolvedResolution?: string;
    peer?: boolean;
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
export type DuplicatesReportTitle = "duplicates" | "matches";
export interface DuplicatesReportOptions {
    title: DuplicatesReportTitle;
    packages: DuplicatePackageView[];
    notice?: string;
    totalDependencies: number;
    clusterFixes?: ClusterFix[];
    dedupeCommand: string;
    whyCommand?: string;
    details?: boolean;
    color?: boolean;
    log?: (message?: string) => void;
}
export declare const renderDuplicatesReport: ({ title, packages, notice, totalDependencies, clusterFixes, dedupeCommand, whyCommand, details, color: colorEnabled, log, }: DuplicatesReportOptions) => void;
//# sourceMappingURL=renderDuplicatesReport.d.ts.map