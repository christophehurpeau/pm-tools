import { packageEntries } from "./syml.js";
import { parseYarnDescriptor, splitEntryKey } from "./yarnDescriptor.js";
/**
 * A package carrying peer dependencies is resolved once per peer context, each
 * under its own `virtual:<hash>#` prefix. The prefix names the context, not a
 * different release, so it is stripped: left in, one version installed under
 * three peer contexts would read as three duplicates.
 */
const virtualPattern = /^(?<name>.+)@virtual:[^#]*#(?<target>.+)$/u;
const devirtualize = (resolution) => {
    const groups = virtualPattern.exec(resolution)?.groups;
    return groups ? `${groups.name}@${groups.target}` : resolution;
};
/**
 * A patched package is its own install with its own tree, and yarn keeps it
 * apart from the release it patches — so it stays a non-npm resolution rather
 * than being folded onto the version it patches.
 */
const toYarnPackage = (resolution, entry) => {
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
export const parseYarnLockPackages = (entries) => {
    const packages = new Map();
    const byResolution = new Map();
    for (const [entryKey, entry] of packageEntries(entries)) {
        // A lockfile written by hand can omit `resolution`; the descriptor names the
        // same package, only with the requested range instead of the version.
        const resolution = devirtualize(entry.resolution ?? splitEntryKey(entryKey)[0]);
        const yarnPackage = byResolution.get(resolution) ?? toYarnPackage(resolution, entry);
        byResolution.set(resolution, yarnPackage);
        for (const descriptorString of splitEntryKey(entryKey)) {
            packages.set(descriptorString, yarnPackage);
        }
    }
    return packages;
};
//# sourceMappingURL=parseYarnLockPackages.js.map