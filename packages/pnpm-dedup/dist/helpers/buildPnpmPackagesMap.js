// Several packages can share the same name but different versions (duplicates).
// When a single resolution is installed in several peer contexts, every context
// is listed in `installations`.
export function buildPnpmPackagesMap({ packages, installationsByResolution, }) {
    const packagesMap = {};
    for (const pkg of packages.values()) {
        if (!packagesMap[pkg.name]) {
            packagesMap[pkg.name] = [];
        }
        packagesMap[pkg.name].push({
            resolution: pkg.resolution,
            package: pkg,
            installations: installationsByResolution.get(pkg.resolution) ?? [
                pkg.resolution,
            ],
        });
    }
    return packagesMap;
}
export function filterDuplicatesPnpmPackagesMap(packagesMap) {
    return Object.fromEntries(Object.entries(packagesMap).filter(([, resolutions]) => resolutions.length > 1));
}
//# sourceMappingURL=buildPnpmPackagesMap.js.map