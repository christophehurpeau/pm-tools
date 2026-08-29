import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildYarnPackagesMap } from "./buildYarnPackagesMap.ts";
import type { PackagesMap } from "./buildYarnPackagesMap.ts";
import {
  collectWorkspaces,
  createManifestReader,
} from "./collectWorkspaces.ts";
import type { Workspace } from "./collectWorkspaces.ts";
import { parseYarnLockPackages } from "./parseYarnLockPackages.ts";
import type { YarnLockPackages } from "./parseYarnLockPackages.ts";
import { parseYarnLock } from "./syml.ts";
import type { YarnEntries } from "./syml.ts";

export const fixtureDir = (name: string): string =>
  fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));

export const readFixtureLock = (name: string): string =>
  readFileSync(`${fixtureDir(name)}/yarn.lock`, "utf8");

export interface LoadedFixture {
  entries: YarnEntries;
  packages: YarnLockPackages;
  packagesMap: PackagesMap;
  workspaces: Workspace[];
}

export const loadFixture = (name: string): LoadedFixture => {
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
