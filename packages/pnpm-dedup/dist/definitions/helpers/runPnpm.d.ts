export interface PnpmRunResult {
    status: number | null;
    output: string;
}
export interface RunPnpmOptions {
    cwd?: string;
    stdio?: "inherit" | "pipe";
}
export type PnpmRunner = (args: string[], options?: RunPnpmOptions) => PnpmRunResult;
export declare const runPnpm: PnpmRunner;
//# sourceMappingURL=runPnpm.d.ts.map