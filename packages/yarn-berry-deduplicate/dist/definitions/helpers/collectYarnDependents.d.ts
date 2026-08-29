import type { Workspace } from "./collectWorkspaces.ts";
import type { YarnLockPackages, YarnPackage } from "./parseYarnLockPackages.ts";
export interface Dependent {
    /** how the requester is named in reports */
    key: string;
    /** the range this requester declares */
    version: string;
    aliasKey?: string;
    yarnPackage?: YarnPackage;
    workspace?: {
        path: string;
        depType: string;
    };
    resolvedVersion?: string;
    resolvedResolution?: string;
    nonSemver?: true;
    peer?: true;
}
export type DependentsMap = Map<string, Dependent[]>;
export interface CollectYarnDependentsOptions {
    packages: YarnLockPackages;
    workspaces: Workspace[];
    onlyPackageNames?: string[];
}
export declare const collectYarnDependents: ({ packages, workspaces, onlyPackageNames, }: CollectYarnDependentsOptions) => DependentsMap;
//# sourceMappingURL=collectYarnDependents.d.ts.map