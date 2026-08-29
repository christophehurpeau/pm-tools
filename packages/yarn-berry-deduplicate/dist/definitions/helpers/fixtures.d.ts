import type { PackagesMap } from "./buildYarnPackagesMap.ts";
import type { Workspace } from "./collectWorkspaces.ts";
import type { YarnLockPackages } from "./parseYarnLockPackages.ts";
import type { YarnEntries } from "./syml.ts";
export declare const fixtureDir: (name: string) => string;
export declare const readFixtureLock: (name: string) => string;
export interface LoadedFixture {
    entries: YarnEntries;
    packages: YarnLockPackages;
    packagesMap: PackagesMap;
    workspaces: Workspace[];
}
export declare const loadFixture: (name: string) => LoadedFixture;
//# sourceMappingURL=fixtures.d.ts.map