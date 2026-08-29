import type { ClusterFix, DuplicateSnapshot, PackageFilterOptions, PlannedOverride } from "pm-utils";
export type ClusterApplyStatus = "applied" | "dry-run" | "nothing-to-do" | "reverted";
export interface ClusterApplyOutcome {
    status: ClusterApplyStatus;
    before: DuplicateSnapshot;
    after: DuplicateSnapshot;
    stickyOverrides: PlannedOverride[];
    plannedChangeCount: number;
}
export interface ApplyClusterFixesOptions {
    projectDir: string;
    dryRun?: boolean;
    log?: (message?: string) => void;
    resolve?: () => number | null;
    verifyFrozen?: () => number | null;
    readFixes?: (projectDir: string) => ClusterFix[];
    readDuplicates?: (lockPath: string) => DuplicateSnapshot;
    filter?: PackageFilterOptions;
    packageManagerResiduals?: string;
    color?: boolean;
}
export declare const applyClusterFixes: ({ projectDir, dryRun, log, resolve, verifyFrozen, readFixes, readDuplicates, filter, packageManagerResiduals, color, }: ApplyClusterFixesOptions) => ClusterApplyOutcome;
//# sourceMappingURL=applyClusterFixes.d.ts.map