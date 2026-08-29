import { packageEntries } from "./syml.ts";
import type { YarnEntries, YarnEntry } from "./syml.ts";
import { parseYarnDescriptor, splitEntryKey } from "./yarnDescriptor.ts";
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

/**
 * A package carrying peer dependencies is resolved once per peer context, each
 * under its own `virtual:<hash>#` prefix. The prefix names the context, not a
 * different release, so it is stripped: left in, one version installed under
 * three peer contexts would read as three duplicates.
 */
const virtualPattern = /^(?<name>.+)@virtual:[^#]*#(?<target>.+)$/u;

const devirtualize = (resolution: string): string => {
  const groups = virtualPattern.exec(resolution)?.groups;
  return groups ? `${groups.name!}@${groups.target!}` : resolution;
};

/**
 * A patched package is its own install with its own tree, and yarn keeps it
 * apart from the release it patches — so it stays a non-npm resolution rather
 * than being folded onto the version it patches.
 */
const toYarnPackage = (resolution: string, entry: YarnEntry): YarnPackage => {
  const descriptor = parseYarnDescriptor(resolution);
  const name = descriptor.npmName;

  return descriptor.protocol === "npm"
    ? {
        type: "npm",
        name,
        resolution,
        version: entry.version || descriptor.selector,
        entry,
      }
    : { type: "other", name, resolution, protocol: descriptor.protocol, entry };
};

export const parseYarnLockPackages = (
  entries: YarnEntries,
): YarnLockPackages => {
  const packages: YarnLockPackages = new Map();
  const byResolution = new Map<string, YarnPackage>();

  for (const [entryKey, entry] of packageEntries(entries)) {
    // A lockfile written by hand can omit `resolution`; the descriptor names the
    // same package, only with the requested range instead of the version.
    const resolution = devirtualize(
      entry.resolution ?? splitEntryKey(entryKey)[0]!,
    );

    const yarnPackage =
      byResolution.get(resolution) ?? toYarnPackage(resolution, entry);
    byResolution.set(resolution, yarnPackage);

    for (const descriptorString of splitEntryKey(entryKey)) {
      packages.set(descriptorString, yarnPackage);
    }
  }

  return packages;
};
