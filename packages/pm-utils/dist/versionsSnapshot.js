import semver from "semver";
const versionLabel = (pkg) => pkg.type === "npm" && pkg.version !== undefined && pkg.version !== ""
    ? pkg.version
    : pkg.resolution;
const compareVersions = (a, b) => semver.valid(a) !== null && semver.valid(b) !== null
    ? semver.compare(a, b)
    : a.localeCompare(b);
export const buildVersionsSnapshot = (packages) => {
    const snapshot = new Map();
    for (const pkg of packages) {
        const version = versionLabel(pkg);
        const versions = snapshot.get(pkg.name);
        if (versions === undefined) {
            snapshot.set(pkg.name, [version]);
        }
        else if (!versions.includes(version)) {
            versions.push(version);
        }
    }
    for (const versions of snapshot.values())
        versions.sort(compareVersions);
    return snapshot;
};
/**
 * What the two snapshots say a run collapsed, one entry per package: both sides
 * whole, so a family converging on an older release reads as the two copies
 * becoming one rather than as a downgrade.
 *
 * Only a package resolved fewer times than before is reported. A version that
 * moved without a copy going away is a re-resolution, not a dedupe — the pass
 * that made the edit already said so — and a package that left the lockfile
 * entirely is neither: the in-memory rewrite drops the private subtrees of the
 * versions it replaced, entries the next install resolves again.
 */
export const diffVersionsSnapshots = (before, after) => {
    const deduped = [];
    for (const [packageName, versions] of before) {
        const remaining = after.get(packageName);
        if (remaining === undefined || remaining.length === 0)
            continue;
        if (remaining.length >= versions.length)
            continue;
        deduped.push({ packageName, before: versions, after: remaining });
    }
    return deduped.toSorted((a, b) => a.packageName.localeCompare(b.packageName));
};
// Packages the lockfile still resolves more than once.
export const countDuplicatedPackages = (snapshot) => [...snapshot.values()].filter((versions) => versions.length > 1).length;
//# sourceMappingURL=versionsSnapshot.js.map