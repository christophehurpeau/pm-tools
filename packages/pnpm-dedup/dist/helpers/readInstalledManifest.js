import { readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { stripPeerSuffix } from "./parsePnpmLockPackages.js";
const readManifestFile = (path) => {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return undefined;
    }
};
const readdirOrEmpty = (path) => {
    try {
        return readdirSync(path);
    }
    catch {
        return [];
    }
};
const readModulesState = (nodeModulesDir) => {
    const hoistedLocations = new Map();
    const parsed = (() => {
        try {
            const content = parseYaml(readFileSync(join(nodeModulesDir, ".modules.yaml"), "utf8"));
            return typeof content === "object" && content !== null
                ? content
                : undefined;
        }
        catch {
            return undefined;
        }
    })();
    const hoisted = parsed?.hoistedLocations;
    if (typeof hoisted === "object" && hoisted !== null) {
        for (const [depPath, paths] of Object.entries(hoisted)) {
            if (!Array.isArray(paths))
                continue;
            const key = stripPeerSuffix(depPath);
            hoistedLocations.set(key, [
                ...(hoistedLocations.get(key) ?? []),
                ...paths.filter((path) => typeof path === "string"),
            ]);
        }
    }
    const virtualStoreDir = parsed?.virtualStoreDir;
    return {
        virtualStoreDir: typeof virtualStoreDir === "string" ? virtualStoreDir : ".pnpm",
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
export const createManifestReaderWithStats = (projectDir) => {
    const nodeModulesDir = join(projectDir, "node_modules");
    const modules = readModulesState(nodeModulesDir);
    // `virtualStoreDir` is configurable and recorded in `.modules.yaml`, relative
    // to node_modules unless absolute
    const pnpmDir = isAbsolute(modules.virtualStoreDir)
        ? modules.virtualStoreDir
        : join(nodeModulesDir, modules.virtualStoreDir);
    const cache = new Map();
    const stats = { found: 0, missed: 0 };
    const virtualStoreEntries = readdirOrEmpty(pnpmDir);
    const hoistedLocations = modules.hoistedLocations;
    // top-level package dirs, for the nested lookup of the hoisted layout
    const hoistedDependents = (() => {
        let dirs;
        return () => {
            dirs ??= readdirOrEmpty(nodeModulesDir).flatMap((entry) => entry.startsWith("@")
                ? readdirOrEmpty(join(nodeModulesDir, entry)).map((scoped) => join(entry, scoped))
                : [entry]);
            return dirs;
        };
    })();
    const fromVirtualStore = (name, version) => {
        const target = `${name.replaceAll("/", "+")}@${version}`;
        const dir = virtualStoreEntries.find((entry) => entry === target ||
            entry.startsWith(`${target}(`) ||
            entry.startsWith(`${target}_`));
        return dir
            ? readManifestFile(join(pnpmDir, dir, "node_modules", name, "package.json"))
            : undefined;
    };
    const fromHoisted = (name, version) => {
        const atVersion = (path) => {
            const manifest = readManifestFile(path);
            return manifest?.version === version ? manifest : undefined;
        };
        // the recorded locations are relative to the project directory
        for (const location of hoistedLocations.get(`${name}@${version}`) ?? []) {
            const recorded = atVersion(join(projectDir, location, "package.json"));
            if (recorded)
                return recorded;
        }
        const hoisted = atVersion(join(nodeModulesDir, name, "package.json"));
        if (hoisted)
            return hoisted;
        // no `.modules.yaml`: a version that could not be hoisted lives under
        // whichever dependent needed it, so try one level of nesting
        for (const dependent of hoistedDependents()) {
            const nested = atVersion(join(nodeModulesDir, dependent, "node_modules", name, "package.json"));
            if (nested)
                return nested;
        }
        return undefined;
    };
    const readManifest = (name, version) => {
        const cacheKey = `${name}@${version}`;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }
        const manifest = fromVirtualStore(name, version) ?? fromHoisted(name, version);
        if (manifest) {
            stats.found += 1;
        }
        else {
            stats.missed += 1;
        }
        cache.set(cacheKey, manifest);
        return manifest;
    };
    return { readManifest, stats: () => ({ ...stats }) };
};
export const createManifestReader = (projectDir) => createManifestReaderWithStats(projectDir).readManifest;
//# sourceMappingURL=readInstalledManifest.js.map