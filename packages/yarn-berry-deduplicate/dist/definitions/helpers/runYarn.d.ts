export interface YarnRunResult {
    status: number | null;
    output: string;
}
export interface RunYarnOptions {
    cwd?: string;
    stdio?: "inherit" | "pipe";
}
export type YarnRunner = (args: string[], options?: RunYarnOptions) => YarnRunResult;
export declare const runYarn: YarnRunner;
//# sourceMappingURL=runYarn.d.ts.map