// ici on a plusieurs packages avec le meme nom mais differentes versions
// en revanche si ils sont installés à plusieurs endroits, on le verra dans installations.
export function buildPackagesMap(packages) {
    const resolutionsMap = {};
    const packagesMap = {};
    for (const [key, pkg] of packages.entries()) {
        if (!packagesMap[pkg.name]) {
            packagesMap[pkg.name] = [];
        }
        const packageResolution = resolutionsMap[pkg.resolution];
        if (packageResolution) {
            packageResolution.installations.push(key);
        }
        else {
            resolutionsMap[pkg.resolution] = {
                resolution: pkg.resolution,
                package: pkg,
                installations: [key],
            };
            packagesMap[pkg.name].push(resolutionsMap[pkg.resolution]);
        }
    }
    return packagesMap;
}
export function filterDuplicatesPackagesMap(packagesMap) {
    return Object.fromEntries(Object.entries(packagesMap).filter(([, resolutions]) => resolutions.length > 1));
}
//# sourceMappingURL=buildPackagesMap.js.map