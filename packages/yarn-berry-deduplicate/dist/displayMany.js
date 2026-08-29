import { renderDuplicatesReport } from "pm-utils";
import semver from "semver";
// the fixes carry full resolutions (`metro@npm:0.84.5`); the report shows
// versions, the package name being the block it sits under
const stripName = (packageName, resolution) => resolution.startsWith(`${packageName}@npm:`)
    ? resolution.slice(packageName.length + "@npm:".length)
    : resolution;
const toDedupeViews = (packageName, fixes) => (fixes ?? []).map((fix) => {
    const from = fix.mergeableResolutions
        .filter((resolution) => resolution !== fix.to)
        .map((resolution) => stripName(packageName, resolution));
    const to = stripName(packageName, fix.to);
    return {
        from,
        to,
        // merging onto a lower installed version is legitimate here — the copy is
        // already in the lockfile — but it is a downgrade for whoever resolved
        // higher, so it is named
        direction: from.some((version) => semver.gt(version, to)) ? "down" : "up",
    };
});
const toPackageViews = ({ duplicatesPackagesMap, dependents, identifiedFixesMap, }) => Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => {
    if (!resolutions) {
        throw new Error(`Unexpected error: no resolutions found for package ${packageName}`);
    }
    return {
        packageName,
        resolutions: resolutions.map(({ resolution, package: yarnPackage, installations }) => ({
            resolution,
            version: yarnPackage.type === "npm" ? yarnPackage.version : undefined,
            installations,
        })),
        dependents: (dependents.get(packageName) ?? []).map((dependent) => ({
            // the range alone does not say which declaration it comes from when the
            // requester reaches the package through a key of another name
            requester: dependent.aliasKey === undefined
                ? dependent.key
                : `${dependent.key} (as "${dependent.aliasKey}")`,
            range: dependent.version,
            resolvedVersion: dependent.resolvedVersion,
            resolvedResolution: dependent.resolvedResolution,
            peer: dependent.peer,
        })),
        dedupe: toDedupeViews(packageName, identifiedFixesMap?.get(packageName)).filter((view) => view.from.length > 0),
    };
});
export const displayMany = (options) => {
    renderDuplicatesReport({
        title: options.title,
        notice: options.notice,
        packages: toPackageViews(options),
        totalDependencies: options.totalDependencies,
        clusterFixes: options.clusterFixes,
        dedupeCommand: "yarn-berry-deduplicate",
        whyCommand: "yarn-berry-why-duplicate",
        details: options.details,
        color: options.color,
        log: options.log,
    });
};
//# sourceMappingURL=displayMany.js.map