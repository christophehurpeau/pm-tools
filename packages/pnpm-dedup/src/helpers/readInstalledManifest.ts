import { readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { stripPeerSuffix } from "./parsePnpmLockPackages.ts";

export interface InstalledManifest {
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export type ManifestReader = (
  name: string,
  version: string,
) => InstalledManifest | undefined;

export interface ManifestReaderStats {
  found: number;
  missed: number;
}

const readManifestFile = (path: string): InstalledManifest | undefined => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as InstalledManifest;
  } catch {
    return undefined;
  }
};

const readdirOrEmpty = (path: string): string[] => {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
};

// pnpm records where it put every package in `node_modules/.modules.yaml`
// (`hoistedLocations`), keyed by dep path — `metro@0.87.0(supports-color@8.1.1)`
// -> `["node_modules/@tamagui/metro-plugin/node_modules/metro"]`. It is written
// as JSON by current pnpm and as YAML by older ones.
interface ModulesState {
  virtualStoreDir: string;
  // dep path (peer suffix stripped) -> paths, relative to the project dir
  hoistedLocations: Map<string, string[]>;
}

const readModulesState = (nodeModulesDir: string): ModulesState => {
  const hoistedLocations = new Map<string, string[]>();

  const parsed = ((): Record<string, unknown> | undefined => {
    try {
      const content = parseYaml(
        readFileSync(join(nodeModulesDir, ".modules.yaml"), "utf8"),
      ) as unknown;
      return typeof content === "object" && content !== null
        ? (content as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  })();

  const hoisted = parsed?.hoistedLocations;
  if (typeof hoisted === "object" && hoisted !== null) {
    for (const [depPath, paths] of Object.entries(
      hoisted as Record<string, unknown>,
    )) {
      if (!Array.isArray(paths)) continue;
      const key = stripPeerSuffix(depPath);
      hoistedLocations.set(key, [
        ...(hoistedLocations.get(key) ?? []),
        ...paths.filter((path): path is string => typeof path === "string"),
      ]);
    }
  }

  const virtualStoreDir = parsed?.virtualStoreDir;

  return {
    virtualStoreDir:
      typeof virtualStoreDir === "string" ? virtualStoreDir : ".pnpm",
    hoistedLocations,
  };
};
/**
 * Build a reader that locates an installed package's manifest, whichever
 * node-linker the project uses:
 *
 * - virtual store (pnpm's default): the dep path gives the directory,
 *   `node_modules/.pnpm/<name with / replaced by +>@<version>[(peers)|_hash]/node_modules/<name>`;
 * - `nodeLinker: hoisted`: the layout is npm-shaped and placement is a hoisting
 *   decision, so `node_modules/.modules.yaml` is consulted for the exact paths;
 *   a flat `node_modules/<name>` and one level of nesting are tried as a
 *   fallback when that file is missing.
 *
 * `stats` tells callers whether anything was readable at all: every declared
 * range comes from these manifests, so a reader that finds nothing silently
 * turns every dependent's range into an exact pin and hides every fix.
 */
export const createManifestReaderWithStats = (
  projectDir: string,
): { readManifest: ManifestReader; stats: () => ManifestReaderStats } => {
  const nodeModulesDir = join(projectDir, "node_modules");
  const modules = readModulesState(nodeModulesDir);
  // `virtualStoreDir` is configurable and recorded in `.modules.yaml`, relative
  // to node_modules unless absolute
  const pnpmDir = isAbsolute(modules.virtualStoreDir)
    ? modules.virtualStoreDir
    : join(nodeModulesDir, modules.virtualStoreDir);
  const cache = new Map<string, InstalledManifest | undefined>();
  const stats: ManifestReaderStats = { found: 0, missed: 0 };

  const virtualStoreEntries = readdirOrEmpty(pnpmDir);
  const hoistedLocations = modules.hoistedLocations;
  // top-level package dirs, for the nested lookup of the hoisted layout
  const hoistedDependents = (() => {
    let dirs: string[] | undefined;
    return (): string[] => {
      dirs ??= readdirOrEmpty(nodeModulesDir).flatMap((entry) =>
        entry.startsWith("@")
          ? readdirOrEmpty(join(nodeModulesDir, entry)).map((scoped) =>
              join(entry, scoped),
            )
          : [entry],
      );
      return dirs;
    };
  })();

  const fromVirtualStore = (
    name: string,
    version: string,
  ): InstalledManifest | undefined => {
    const target = `${name.replaceAll("/", "+")}@${version}`;
    const dir = virtualStoreEntries.find(
      (entry) =>
        entry === target ||
        entry.startsWith(`${target}(`) ||
        entry.startsWith(`${target}_`),
    );
    return dir
      ? readManifestFile(
          join(pnpmDir, dir, "node_modules", name, "package.json"),
        )
      : undefined;
  };

  const fromHoisted = (
    name: string,
    version: string,
  ): InstalledManifest | undefined => {
    const atVersion = (path: string): InstalledManifest | undefined => {
      const manifest = readManifestFile(path);
      return manifest?.version === version ? manifest : undefined;
    };

    // the recorded locations are relative to the project directory
    for (const location of hoistedLocations.get(`${name}@${version}`) ?? []) {
      const recorded = atVersion(join(projectDir, location, "package.json"));
      if (recorded) return recorded;
    }

    const hoisted = atVersion(join(nodeModulesDir, name, "package.json"));
    if (hoisted) return hoisted;

    // no `.modules.yaml`: a version that could not be hoisted lives under
    // whichever dependent needed it, so try one level of nesting
    for (const dependent of hoistedDependents()) {
      const nested = atVersion(
        join(nodeModulesDir, dependent, "node_modules", name, "package.json"),
      );
      if (nested) return nested;
    }

    return undefined;
  };

  const readManifest: ManifestReader = (name, version) => {
    const cacheKey = `${name}@${version}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const manifest =
      fromVirtualStore(name, version) ?? fromHoisted(name, version);
    if (manifest) {
      stats.found += 1;
    } else {
      stats.missed += 1;
    }

    cache.set(cacheKey, manifest);
    return manifest;
  };

  return { readManifest, stats: () => ({ ...stats }) };
};

export const createManifestReader = (projectDir: string): ManifestReader =>
  createManifestReaderWithStats(projectDir).readManifest;
