import type { ClusterFix, DuplicateSnapshot, PlannedOverride } from "pm-utils";
export type ClusterApplyStatus = "applied" | "dry-run" | "kept-overrides" | "not-supported" | "nothing-to-do" | "reverted";
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
    readFixes?: (projectDir: string) => ClusterFix[];
    readDuplicates?: (lockPath: string) => DuplicateSnapshot;
    pnpmVersion?: () => string | null;
    convergenceOverrides?: boolean;
    packageManagerResiduals?: string;
    color?: boolean;
}
export declare const applyClusterFixes: ({ projectDir, dryRun, log, resolve, readFixes, readDuplicates, pnpmVersion, convergenceOverrides, packageManagerResiduals, color, }: ApplyClusterFixesOptions) => ClusterApplyOutcome;
//# sourceMappingURL=applyClusterFixes.d.ts.map