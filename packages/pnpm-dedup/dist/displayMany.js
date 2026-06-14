export const displayMany = (title, duplicatesPackagesMap, dependents, devDependencyFixes, log = console.log) => {
    const titleSingular = title === "duplicates" ? "duplicate" : "match";
    const duplicatePackageNames = Object.keys(duplicatesPackagesMap);
    if (duplicatePackageNames.length === 0) {
        log("No duplicates found");
        return;
    }
    log(`Found ${duplicatePackageNames.length} ${duplicatePackageNames.length === 1 ? titleSingular : title}:`);
    for (const packageName of duplicatePackageNames) {
        log();
        log(`${packageName}:`);
        log("  Resolutions:");
        const resolutions = duplicatesPackagesMap[packageName];
        if (!resolutions) {
            throw new Error(`Unexpected error: no resolutions found for package ${packageName}`);
        }
        for (const { resolution, installations } of resolutions) {
            log(`    - ${resolution}`);
            if (installations.length > 1) {
                log("      Installed at:");
                for (const location of installations) {
                    log(`        - ${location}`);
                }
            }
        }
        const sources = dependents.get(packageName);
        if (sources) {
            log("  Dependents:");
            for (const dependent of sources) {
                log(`    - ${dependent.key} asking for "${dependent.version}"`);
            }
        }
        const fix = devDependencyFixes?.get(packageName);
        if (fix) {
            log("  Suggested fix:");
            log(`    - add "${fix.name}": "${fix.version}" to devDependencies, then run \`pnpm install\``);
        }
    }
};
//# sourceMappingURL=displayMany.js.map