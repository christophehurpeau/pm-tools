const directionLabel = (direction) => {
    if (direction === "down")
        return " (downgrade)";
    if (direction === "up")
        return " (upgrade)";
    return "";
};
const displayClusterFixes = (clusterFixes, log) => {
    const applicable = clusterFixes.filter((fix) => fix.duplicatedMembers.length > 0);
    if (applicable.length === 0)
        return;
    log();
    log(`Found ${applicable.length} lockstep ${applicable.length === 1 ? "cluster" : "clusters"}:`);
    for (const fix of applicable) {
        log();
        log(`Cluster of ${fix.members.length} packages (${fix.duplicatedMembers.length} duplicated):`);
        log(`  Members: ${fix.members.join(", ")}`);
        if (!fix.applicable || fix.target === null) {
            log("  No common version satisfies every external constraint — cannot dedupe");
        }
        else {
            log(`  Dedupe to ${fix.target}${directionLabel(fix.direction)}`);
            if (fix.needsRoundTrip) {
                log("  Add to devDependencies, then run `bun install`:");
                for (const member of fix.reResolutionSet) {
                    log(`    "${member}": "${fix.target}"`);
                }
            }
            else {
                log("  Applicable from the lockfile (target already installed)");
            }
        }
        if (fix.externalConstraints.length > 0) {
            log("  External constraints:");
            for (const constraint of fix.externalConstraints) {
                log(`    - ${constraint.requesterName ?? "workspace"} requires ${constraint.packageName} "${constraint.range}"`);
            }
        }
    }
};
export const displayMany = ({ title, duplicatesPackagesMap, dependents, identifiedFixesMap, clusterFixes, log = console.log, }) => {
    const titleSingular = title === "duplicates" ? "duplicate" : "match";
    const duplicatePackageNames = Object.keys(duplicatesPackagesMap);
    if (duplicatePackageNames.length === 0) {
        log("No duplicates found");
        if (clusterFixes)
            displayClusterFixes(clusterFixes, log);
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
        const fixes = identifiedFixesMap?.get(packageName);
        if (fixes && fixes.length > 0) {
            log("  Possible fixes: (run `bun-dedupe` to apply)");
            for (const fix of fixes) {
                log(`    - ${fix.megeableResolutions.filter((r) => r !== fix.to).join(" and ")} can be merged with ${fix.to}`);
            }
        }
    }
    if (clusterFixes)
        displayClusterFixes(clusterFixes, log);
};
//# sourceMappingURL=displayMany.js.map