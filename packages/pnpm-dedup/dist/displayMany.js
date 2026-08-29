import { renderDuplicatesReport } from "pm-utils";
// A cluster of one is the package's own fix: nothing else converges with it, so
// it is rendered in the package's block instead of the cluster section.
const isSingleton = (fix) => fix.members.length === 1;
const toDedupeViews = (packageName, clusterFixes) => clusterFixes
    .filter((fix) => isSingleton(fix) &&
    fix.members[0] === packageName &&
    fix.applicable &&
    fix.target !== null)
    .map((fix) => ({
    // the target is what the copies merge into; the other installed versions
    // are what goes away
    from: (fix.memberVersions[packageName]?.versions ?? []).filter((version) => version !== fix.target),
    to: fix.target,
    direction: fix.direction,
}))
    .filter((view) => view.from.length > 0);
const toPackageViews = ({ duplicatesPackagesMap, dependents, clusterFixes = [], }) => Object.entries(duplicatesPackagesMap).map(([packageName, resolutions]) => {
    if (!resolutions) {
        throw new Error(`Unexpected error: no resolutions found for package ${packageName}`);
    }
    return {
        packageName,
        resolutions: resolutions.map(({ resolution, package: pnpmPackage, installations }) => ({
            resolution,
            version: pnpmPackage.type === "npm" ? pnpmPackage.version : undefined,
            installations,
        })),
        dependents: (dependents.get(packageName) ?? []).map((dependent) => ({
            requester: dependent.key,
            range: dependent.range,
            resolvedVersion: dependent.resolvedVersion,
            peer: dependent.peer,
        })),
        dedupe: toDedupeViews(packageName, clusterFixes),
    };
});
export const displayMany = (options) => {
    renderDuplicatesReport({
        title: options.title,
        notice: options.notice,
        packages: toPackageViews(options),
        totalDependencies: options.totalDependencies,
        clusterFixes: (options.clusterFixes ?? []).filter((fix) => !isSingleton(fix)),
        dedupeCommand: "pnpm-dedupe",
        whyCommand: "pnpm-why-duplicate",
        details: options.details,
        color: options.color,
        log: options.log,
    });
};
//# sourceMappingURL=displayMany.js.map