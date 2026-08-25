export type DuplicateSnapshot = Set<string>;
export interface DuplicateDiff {
    removed: string[];
    added: string[];
    improved: boolean;
}
export declare const diffDuplicates: (before: DuplicateSnapshot, after: DuplicateSnapshot) => DuplicateDiff;
//# sourceMappingURL=duplicateSnapshot.d.ts.map