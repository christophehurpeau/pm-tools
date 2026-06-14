import { buildLockstepClusters } from "pm-utils";
import semver from "semver";
import { collectDependents } from "./helpers/collectDependents.js";
import { toLockstepGraph } from "./helpers/toLockstepGraph.js";
const npmVersionsOf = (packagesMap, member) => {
    const resolutions = packagesMap[member] ?? [];
    return resolutions
        .filter((resolution) => resolution.package.type === "npm")
        .map((resolution) => resolution.package.type === "npm" ? resolution.package.version : "");
};
const directionOf = (maxInstalled, target) => {
    if (!maxInstalled)
        return "none";
    if (semver.gt(maxInstalled, target))
        return "down";
    if (semver.lt(maxInstalled, target))
        return "up";
    return "same";
};
// Compute lockstep-cluster dedupe opportunities that the per-package
// `identifyResolutionFixes` cannot: a family of co-versioned packages where the
// duplicate is kept alive only because a few externally-requested roots resolve
// high. The fix converges the whole family onto a single version honoring every
// external constraint; the heavy lifting (fetching absent root manifests and
// cascading the internal pins) is delegated to bun via a `bun install`
// round-trip, surfaced here as the `reResolutionSet` / `needsRoundTrip` flag.
export const identifyClusterFixes = (packagesMap, packages, workspaces) => {
    const clusters = buildLockstepClusters(toLockstepGraph(packagesMap));
    if (clusters.length === 0)
        return [];
    const memberNames = [...new Set(clusters.flat())];
    const dependents = collectDependents(packages, workspaces, memberNames);
    const fixes = [];
    for (const members of clusters) {
        const memberSet = new Set(members);
        const duplicatedMembers = members.filter((member) => (packagesMap[member]?.length ?? 0) > 1);
        // a cluster with no duplicated member has nothing to dedupe
        if (duplicatedMembers.length === 0)
            continue;
        const externalConstraints = [];
        const membersWithExternalDependent = new Set();
        for (const member of members) {
            for (const dependent of dependents.get(member) ?? []) {
                const requesterName = dependent.bunPackage?.name;
                const isInternal = requesterName !== undefined && memberSet.has(requesterName);
                if (isInternal)
                    continue;
                externalConstraints.push({
                    requester: dependent.key,
                    requesterName,
                    packageName: member,
                    range: dependent.version,
                });
                membersWithExternalDependent.add(member);
            }
        }
        const candidateVersions = [
            ...new Set(members.flatMap((member) => npmVersionsOf(packagesMap, member))),
        ];
        const externalRanges = [
            ...new Set(externalConstraints.map((constraint) => constraint.range)),
        ];
        const satisfyingVersions = candidateVersions.filter((version) => externalRanges.every((range) => semver.satisfies(version, range, { includePrerelease: true })));
        if (satisfyingVersions.length === 0) {
            fixes.push({
                members,
                duplicatedMembers,
                target: null,
                direction: "none",
                reResolutionSet: [],
                externalConstraints,
                needsRoundTrip: false,
                applicable: false,
            });
            continue;
        }
        const target = satisfyingVersions.toSorted((a, b) => semver.rcompare(a, b))[0];
        const maxInstalled = candidateVersions.toSorted((a, b) => semver.rcompare(a, b))[0];
        // re-resolution set: members pulled from outside the cluster whose target
        // version is not already installed (so a pure-lock copy is impossible and a
        // round-trip is required). Internal-only members cascade from these; members
        // whose target is already installed are handled by the pure-lock pass.
        const reResolutionSet = members
            .filter((member) => {
            if (!membersWithExternalDependent.has(member))
                return false;
            const installed = npmVersionsOf(packagesMap, member);
            const targetInstalled = installed.some((version) => semver.eq(version, target));
            return !targetInstalled;
        })
            .toSorted((a, b) => a.localeCompare(b));
        fixes.push({
            members,
            duplicatedMembers,
            target,
            direction: directionOf(maxInstalled, target),
            reResolutionSet,
            externalConstraints,
            needsRoundTrip: reResolutionSet.length > 0,
            applicable: true,
        });
    }
    return fixes;
};
//# sourceMappingURL=identifyClusterFixes.js.map