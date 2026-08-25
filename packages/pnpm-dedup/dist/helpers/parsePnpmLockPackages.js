/**
 * Strip a pnpm peer-dependency suffix (everything from the first `(`).
 *
 * eg `@scope/name@1.2.3(eslint@9)(typescript@5)` -> `@scope/name@1.2.3`
 */
export const stripPeerSuffix = (id) => {
    const parenPos = id.indexOf("(");
    return parenPos === -1 ? id : id.slice(0, parenPos);
};
/**
 * Parse a pnpm package id (`name@version`, optionally peer-suffixed) into its
 * name and version. Handles scoped names (`@scope/name@1.2.3`).
 */
export const parsePackageId = (id) => {
    const base = stripPeerSuffix(id);
    const atPos = base.lastIndexOf("@");
    if (atPos <= 0) {
        return { name: base, version: "" };
    }
    return { name: base.slice(0, atPos), version: base.slice(atPos + 1) };
};
const isNpmVersion = (version) => {
    return /^\d/.test(version);
};
/**
 * Resolve a snapshot dependency entry. The value is either a resolved version
 * (`1.2.3`, possibly peer-suffixed) for which the key is the real npm name, or
 * an aliased `realName@version` form when the key is a local alias.
 */
export const resolveSnapshotDependency = (depName, depValue) => {
    const stripped = stripPeerSuffix(depValue);
    if (isNpmVersion(stripped)) {
        return { name: depName, version: stripped };
    }
    const { name, version } = parsePackageId(stripped);
    return { name: name || depName, version };
};
export const parsePnpmLockPackages = (lock) => {
    const packages = new Map();
    for (const resolution of Object.keys(lock.packages ?? {})) {
        const { name, version } = parsePackageId(resolution);
        packages.set(resolution, {
            type: isNpmVersion(version) ? "npm" : "other",
            name,
            version,
            resolution,
        });
    }
    const installationsByResolution = new Map();
    for (const snapshotKey of Object.keys(lock.snapshots ?? {})) {
        const baseId = stripPeerSuffix(snapshotKey);
        const installations = installationsByResolution.get(baseId);
        if (installations) {
            installations.push(snapshotKey);
        }
        else {
            installationsByResolution.set(baseId, [snapshotKey]);
        }
    }
    return { packages, installationsByResolution };
};
//# sourceMappingURL=parsePnpmLockPackages.js.map