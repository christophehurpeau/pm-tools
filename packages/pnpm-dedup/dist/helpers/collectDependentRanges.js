import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
import { parsePackageId, resolveSnapshotDependency, } from "./parsePnpmLockPackages.js";
const snapshotDepTypes = ["dependencies", "optionalDependencies"];
const manifestDepTypes = [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
];
// a declaration semver cannot read says nothing about the version; the caller
// falls back to the version this requester actually got
const declaredRange = (depName, declared) => {
    const parsed = PackageDependencyDescriptorUtils.parse(depName, declared);
    return isSemverComparable(parsed) ? parsed.selector : undefined;
};
const manifestRange = (manifest, depName) => {
    if (!manifest)
        return undefined;
    for (const depType of manifestDepTypes) {
        const declared = manifest[depType]?.[depName];
        if (declared === undefined)
            continue;
        const range = declaredRange(depName, declared);
        if (range === undefined)
            return undefined;
        return depType === "peerDependencies" ? { range, peer: true } : { range };
    }
    return undefined;
};
/**
 * The peer range as the lockfile itself records it.
 *
 * pnpm resolves peers before writing the lockfile and folds each resolved peer
 * into the snapshot's `dependencies` — which is why a peer edge is found here at
 * all, unlike yarn's, where the fold lives only in the virtual packages the
 * lockfile omits. But the snapshot carries the resolved *version*; the range
 * stays behind in the `packages:` entry. Without it, seventeen plugins declaring
 * `eslint: "^6.0.0 || ^7.0.0 || >=8.0.0"` and the like all read as exact pins of
 * whatever got installed, and no version can satisfy them all — every merge
 * ruled out by ranges that never said so.
 *
 * `packages:` keys carry no peer suffix, so the resolved id addresses the entry
 * directly. `depName` is the key the requester declared, which is what an
 * aliased peer sits under.
 */
const lockfilePeerRange = (lock, dependent, depName) => {
    const declared = lock.packages?.[`${dependent.name}@${dependent.version}`]
        ?.peerDependencies?.[depName];
    if (declared === undefined)
        return undefined;
    const range = declaredRange(depName, declared);
    return range === undefined ? undefined : { range, peer: true };
};
/**
 * Collect, for each duplicated package, the real semver range every dependent
 * declares. Direct (importer) dependents carry their specifier; transitive
 * dependents' ranges are read from their installed manifest (the pnpm lockfile
 * only stores the resolved version, not the range). When a manifest is missing
 * (project not installed), the resolved version is used as an exact fallback.
 */
export const collectDependentRanges = (lock, duplicatePackageNames, readManifest) => {
    const rangesMap = new Map();
    const add = (name, dependent) => {
        if (!duplicatePackageNames.has(name))
            return;
        let dependents = rangesMap.get(name);
        if (!dependents) {
            dependents = [];
            rangesMap.set(name, dependents);
        }
        dependents.push(dependent);
    };
    for (const [importerPath, project] of Object.entries(lock.importers ?? {})) {
        ["dependencies", "devDependencies", "optionalDependencies"].forEach((depType) => {
            const deps = project[depType];
            if (!deps)
                return;
            for (const [depName, { specifier, version }] of Object.entries(deps)) {
                const parsed = PackageDependencyDescriptorUtils.parse(depName, specifier);
                // `workspace:` and `catalog:` name something other than the npm package
                // sharing this key, so they constrain no npm version
                if (!isSemverComparable(parsed))
                    continue;
                add(parsed.npmName, {
                    key: `${importerPath === "." ? "package.json" : importerPath} in ${depType}`,
                    range: parsed.selector,
                    // an aliased importer entry stores `realName@version`, not a version
                    resolvedVersion: resolveSnapshotDependency(depName, version).version,
                    workspace: { path: importerPath, depType },
                });
            }
        });
    }
    for (const [snapshotKey, snapshot] of Object.entries(lock.snapshots ?? {})) {
        const dependent = parsePackageId(snapshotKey);
        snapshotDepTypes.forEach((depType) => {
            const deps = snapshot[depType];
            if (!deps)
                return;
            for (const [depName, depValue] of Object.entries(deps)) {
                const { name, version } = resolveSnapshotDependency(depName, depValue);
                if (!duplicatePackageNames.has(name))
                    continue;
                const source = manifestRange(readManifest(dependent.name, dependent.version), depName) ?? lockfilePeerRange(lock, dependent, depName);
                add(name, {
                    key: `${dependent.name}@${dependent.version}`,
                    range: source?.range ?? version,
                    resolvedVersion: version,
                    requesterName: dependent.name,
                    ...(source?.peer ? { peer: source.peer } : {}),
                });
            }
        });
    }
    return rangesMap;
};
//# sourceMappingURL=collectDependentRanges.js.map