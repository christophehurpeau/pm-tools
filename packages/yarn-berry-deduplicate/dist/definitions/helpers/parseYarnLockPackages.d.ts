import type { YarnEntries, YarnEntry } from "./syml.ts";
import type { YarnProtocol } from "./yarnProtocol.ts";
export interface YarnNpmPackage {
    type: "npm";
    name: string;
    resolution: string;
    version: string;
    entry: YarnEntry;
}
export interface YarnOtherPackage {
    type: "other";
    name: string;
    resolution: string;
    protocol: YarnProtocol | undefined;
    entry: YarnEntry;
}
export type YarnPackage = YarnNpmPackage | YarnOtherPackage;
/** descriptor string -> the package it resolves to */
export type YarnLockPackages = Map<string, YarnPackage>;
export declare const parseYarnLockPackages: (entries: YarnEntries) => YarnLockPackages;
//# sourceMappingURL=parseYarnLockPackages.d.ts.map