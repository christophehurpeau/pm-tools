export interface TempProjects {
    /** A new empty directory, removed by `cleanup`. */
    create: () => string;
    /** Removes every directory created since the last call. */
    cleanup: () => void;
}
export declare const createTempProjects: (prefix: string) => TempProjects;
//# sourceMappingURL=tempProjects.d.ts.map