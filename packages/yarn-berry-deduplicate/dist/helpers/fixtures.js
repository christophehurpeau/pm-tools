import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildYarnPackagesMap } from "./buildYarnPackagesMap.js";
import { collectWorkspaces, createManifestReader, } from "./collectWorkspaces.js";
import { parseYarnLockPackages } from "./parseYarnLockPackages.js";
import { parseYarnLock } from "./syml.js";
export const fixtureDir = (name) => fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));
export const readFixtureLock = (name) => readFileSync(`${fixtureDir(name)}/yarn.lock`, "utf8");
export const loadFixture = (name) => {
    const dir = fixtureDir(name);
    const entries = parseYarnLock(readFixtureLock(name));
    const packages = parseYarnLockPackages(entries);
    return {
        entries,
        packages,
        packagesMap: buildYarnPackagesMap(packages),
        workspaces: collectWorkspaces(packages, createManifestReader(dir)),
    };
};
//# sourceMappingURL=fixtures.js.map