export interface BunRunResult {
    status: number | null;
    output: string;
}
export interface RunBunOptions {
    cwd?: string;
    stdio?: "inherit" | "pipe";
}
export type BunRunner = (args: string[], options?: RunBunOptions) => BunRunResult;
export declare const runBun: BunRunner;
//# sourceMappingURL=runBun.d.ts.map