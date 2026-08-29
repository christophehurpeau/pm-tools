export const buildYarnPackagesMap = (packages) => {
    const resolutionsMap = new Map();
    const packagesMap = {};
    for (const [descriptorString, yarnPackage] of packages) {
        const existing = resolutionsMap.get(yarnPackage.resolution);
        if (existing) {
            existing.installations.push(descriptorString);
            continue;
        }
        const packageResolution = {
            resolution: yarnPackage.resolution,
            package: yarnPackage,
            installations: [descriptorString],
        };
        resolutionsMap.set(yarnPackage.resolution, packageResolution);
        packagesMap[yarnPackage.name] ??= [];
        packagesMap[yarnPackage.name].push(packageResolution);
    }
    return packagesMap;
};
export const filterDuplicatesYarnPackagesMap = (packagesMap) => Object.fromEntries(Object.entries(packagesMap).filter(([, resolutions]) => resolutions.length > 1));
//# sourceMappingURL=buildYarnPackagesMap.js.map