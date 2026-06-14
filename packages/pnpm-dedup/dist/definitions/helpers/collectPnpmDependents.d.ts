import type { PnpmLockFile } from "../pnpmLockTypes.ts";
export interface Dependent {
    key: string;
    version: string;
}
export type DependentsMap = Map<string, Dependent[]>;
export declare function collectPnpmDependents(lock: PnpmLockFile, onlyPackageNames?: string[]): DependentsMap;
//# sourceMappingURL=collectPnpmDependents.d.ts.map