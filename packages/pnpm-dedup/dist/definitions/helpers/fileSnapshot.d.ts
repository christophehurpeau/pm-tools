export interface FileSnapshot {
    path: string;
    content: string | undefined;
}
export declare const captureFiles: (paths: string[]) => FileSnapshot[];
export declare const restoreFiles: (snapshots: FileSnapshot[]) => void;
//# sourceMappingURL=fileSnapshot.d.ts.map