import type { DedupedPackage } from "./versionsSnapshot.ts";
export interface DedupeSummaryOptions {
    deduped: DedupedPackage[];
    remainingDuplicates: number;
    whyCommand: string;
    color?: boolean;
    log?: (message?: string) => void;
}
/**
 * What a dedupe run actually collapsed, one line per package. Shared by every
 * tool so the three of them report a run the same way; the caller still says
 * what it wrote, which only it knows.
 *
 * Both sides are counted and named: `2 versions (1.2.1, 1.3.0) -> 1 version
 * (1.2.1)` is the copy that went away, where a bare `1.3.0 -> 1.2.1` reads as a
 * downgrade the tool decided on its own.
 *
 * Nothing is printed when nothing was deduped: the caller has its own wording
 * for that, and an empty table reads as a failure it may not be.
 */
export declare const renderDedupeSummary: ({ deduped, remainingDuplicates, whyCommand, color: colorEnabled, log, }: DedupeSummaryOptions) => void;
//# sourceMappingURL=renderDedupeSummary.d.ts.map