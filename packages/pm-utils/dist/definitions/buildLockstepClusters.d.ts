export interface LockstepResolution {
    version: string;
    isNpm: boolean;
    dependencies: Record<string, string>;
}
export type LockstepGraph = Record<string, LockstepResolution[]>;
export declare const buildLockstepClusters: (graph: LockstepGraph) => string[][];
//# sourceMappingURL=buildLockstepClusters.d.ts.map