import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface InstalledManifest {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export type ManifestReader = (
  name: string,
  version: string,
) => InstalledManifest | undefined;

/**
 * Build a reader that locates an installed package's manifest under
 * `node_modules/.pnpm`. pnpm stores each package at
 * `node_modules/.pnpm/<name with / replaced by +>@<version>[(peers)|_hash]/node_modules/<name>/package.json`.
 *
 * Returns `undefined` when the project is not installed or the package is
 * absent, so callers degrade gracefully (no transitive ranges available).
 */
export const createManifestReader = (projectDir: string): ManifestReader => {
  const pnpmDir = join(projectDir, "node_modules", ".pnpm");
  const cache = new Map<string, InstalledManifest | undefined>();

  const entries = (() => {
    try {
      return readdirSync(pnpmDir);
    } catch {
      return [];
    }
  })();

  return (name, version) => {
    const cacheKey = `${name}@${version}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined || cache.has(cacheKey)) {
      return cached;
    }

    const target = `${name.replaceAll("/", "+")}@${version}`;
    const dir = entries.find(
      (entry) =>
        entry === target ||
        entry.startsWith(`${target}(`) ||
        entry.startsWith(`${target}_`),
    );

    const manifest = ((): InstalledManifest | undefined => {
      if (!dir) return undefined;
      try {
        const content = readFileSync(
          join(pnpmDir, dir, "node_modules", name, "package.json"),
          "utf8",
        );
        return JSON.parse(content) as InstalledManifest;
      } catch {
        return undefined;
      }
    })();

    cache.set(cacheKey, manifest);
    return manifest;
  };
};
