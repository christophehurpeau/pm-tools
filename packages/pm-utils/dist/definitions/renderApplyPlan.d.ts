export interface ApplyPlanFileChange {
    path: string;
    transient?: string;
    changes: string[];
}
export interface ApplyPlanOptions {
    fileChanges: ApplyPlanFileChange[];
    skipped?: string[];
    packageManagerResiduals?: string;
    dedupeCommand: string;
    color?: boolean;
    log?: (message?: string) => void;
}
export interface ApplyPlanSummary {
    changeCount: number;
}
/**
 * The plan a dedupe run would apply, shared by `--check` and `--dry-run`. The
 * returned `changeCount` is what `--check` gates its exit code on.
 */
export declare const renderApplyPlan: ({ fileChanges, skipped, packageManagerResiduals, dedupeCommand, color: colorEnabled, log, }: ApplyPlanOptions) => ApplyPlanSummary;
//# sourceMappingURL=renderApplyPlan.d.ts.map