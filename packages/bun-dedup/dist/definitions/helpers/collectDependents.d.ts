import type { BunLockFile } from "bun";
import type { BunLockPackages, BunPackage } from "./parseBunLockPackages.ts";
export interface Dependent {
    key: string;
    version: string;
    aliasKey?: string;
    bunPackage?: BunPackage;
    workspace?: {
        path: string;
        depType: string;
    };
    resolvedVersion?: string;
    resolvedResolution?: string;
    nonSemver?: true;
}
export type DependentsMap = Map<string, Dependent[]>;
export declare function collectDependents(packages: BunLockPackages, workspaces: BunLockFile["workspaces"], onlyPackageNames?: string[]): DependentsMap;
//# sourceMappingURL=collectDependents.d.ts.map