import semver from "semver";
const accepts = (version, range) => semver.satisfies(version, range, { includePrerelease: true });
// Prefer a candidate that needs no edit to the user's own package.json — a pin
// is a decision, so changing it is a last resort, taken only when nothing else
// deduplicates anything. Then the candidate that deduplicates the most members,
// then the one already installed for the most of them (a version the lockfile
// never mentions for a member is a far weaker proposal), then the highest.
const betterCandidate = (a, b) => {
    const aRespectsPins = a.pinsToEdit.length === 0 && a.convergentMembers.length > 0;
    const bRespectsPins = b.pinsToEdit.length === 0 && b.convergentMembers.length > 0;
    if (aRespectsPins !== bRespectsPins) {
        return aRespectsPins ? a : b;
    }
    if (a.convergentMembers.length !== b.convergentMembers.length) {
        return a.convergentMembers.length > b.convergentMembers.length ? a : b;
    }
    if (a.installedCount !== b.installedCount) {
        return a.installedCount > b.installedCount ? a : b;
    }
    return semver.gt(a.version, b.version) ? a : b;
};
const directionOf = (replacedVersions, target) => {
    if (replacedVersions.length === 0)
        return "same";
    return replacedVersions.some((version) => semver.gt(version, target))
        ? "down"
        : "up";
};
/**
 * Compute dedupe opportunities for lockstep clusters (see
 * `buildLockstepClusters`) that a per-package pass cannot: a family of
 * co-versioned packages whose duplicate is kept alive only because a few
 * externally-requested members resolve high. The fix converges the family onto
 * a single version; fetching absent manifests and cascading the internal pins
 * is left to the package manager, surfaced here as `reResolutionSet` /
 * `needsRoundTrip`.
 *
 * Two kinds of external constraint are treated differently:
 * - a third-party requester's range is immutable, so a member it rejects the
 *   target for is excluded from the convergence instead of sinking the whole
 *   cluster (clusters routinely span several publishers, and one unfixable
 *   member should not hide the rest);
 * - a workspace pin belongs to the user, so it is reported as a
 *   `workspaceChanges` edit rather than a blocker.
 *
 * Ranges in `dependents` must be the ranges the requesters declare. A package
 * manager that only stores resolved versions in its lockfile has to recover
 * them (pnpm reads the installed manifests) or the constraints read as exact
 * pins and no target is found.
 */
export const identifyLockstepClusterFixes = (clusters, members, dependents) => {
    const fixes = [];
    for (const clusterMembers of clusters) {
        const memberSet = new Set(clusterMembers);
        const npmVersionsOf = (member) => members[member]?.npmVersions ?? [];
        const duplicatedMembers = clusterMembers.filter((member) => (members[member]?.resolutionCount ?? 0) > 1);
        // a cluster with no duplicated member has nothing to dedupe
        if (duplicatedMembers.length === 0)
            continue;
        const memberVersions = Object.fromEntries(clusterMembers.map((member) => {
            const versions = npmVersionsOf(member);
            return [
                member,
                {
                    versions,
                    nonNpmCount: Math.max((members[member]?.resolutionCount ?? 0) - versions.length, 0),
                },
            ];
        }));
        const externalConstraints = [];
        // third-party ranges: the only ones that can rule a version out. A workspace
        // range belongs to the user, so it never blocks — it is ranked against
        // instead (`pinsToEdit`), and proposed for editing only when nothing else
        // deduplicates anything.
        const bindingByMember = new Map();
        const internalByMember = new Map();
        const workspaceConstraints = [];
        const exactWorkspacePins = [];
        const membersWithExternalDependent = new Set();
        for (const member of clusterMembers) {
            for (const dependent of dependents.get(member) ?? []) {
                const isInternal = dependent.requesterName !== undefined &&
                    memberSet.has(dependent.requesterName);
                if (isInternal) {
                    const forMember = internalByMember.get(member) ?? [];
                    forMember.push({
                        requesterName: dependent.requesterName,
                        range: dependent.range,
                    });
                    internalByMember.set(member, forMember);
                    continue;
                }
                const constraint = {
                    requester: dependent.requester,
                    requesterName: dependent.requesterName,
                    packageName: member,
                    range: dependent.range,
                    resolvedVersion: dependent.resolvedVersion,
                    workspace: dependent.workspace,
                };
                externalConstraints.push(constraint);
                membersWithExternalDependent.add(member);
                // An exact workspace pin is as binding as a third-party range: the user
                // chose that version, so the family has to live with it.
                if (constraint.requesterName === undefined) {
                    workspaceConstraints.push(constraint);
                    if (semver.valid(constraint.range) !== null) {
                        exactWorkspacePins.push(constraint);
                    }
                }
                else {
                    const forMember = bindingByMember.get(member);
                    if (forMember) {
                        forMember.push(constraint);
                    }
                    else {
                        bindingByMember.set(member, [constraint]);
                    }
                }
            }
        }
        const candidateVersions = [
            ...new Set(clusterMembers.flatMap(npmVersionsOf)),
        ];
        // A binding range decides whether a member is free to move at all — for a
        // non-duplicated member that means being re-resolved along with the family.
        const rejectingConstraints = (member, version) => (bindingByMember.get(member) ?? []).filter((constraint) => !accepts(version, constraint.range));
        const canMove = (member, version) => rejectingConstraints(member, version).length === 0;
        const isInstalled = (member, version) => npmVersionsOf(member).some((installed) => semver.eq(installed, version));
        // A range that accepts every version the member has installed expresses no
        // preference: it cannot be the reason two copies exist, and it follows
        // whatever the family resolves to.
        const isOpenRange = (member, range) => npmVersionsOf(member).every((version) => accepts(version, range));
        const hasRealConstraint = (member) => [
            ...(bindingByMember.get(member) ?? []),
            ...workspaceConstraints.filter((constraint) => constraint.packageName === member),
        ].some((constraint) => !isOpenRange(member, constraint.range));
        const externalRangesOn = (member) => [
            ...(bindingByMember.get(member) ?? []),
            ...workspaceConstraints.filter((constraint) => constraint.packageName === member),
        ].map((constraint) => constraint.range);
        const rangeFloor = (range) => {
            try {
                return semver.minVersion(range)?.version ?? null;
            }
            catch {
                return null;
            }
        };
        // Re-resolving a member *to a named version* absent from the lock only makes
        // sense when a dependent asks for that version line: `^8.59.1` is evidence
        // that 8.59.1 exists, `*` and `0.83 - 0.86` are not. Without this, any
        // externally-requested member looks free to move anywhere its ranges happen
        // to admit — which is how a react-native@0.87.0 pulled into a metro cluster
        // ends up "converging" on a metro version number.
        const canReResolve = (member, version) => isInstalled(member, version) ||
            !membersWithExternalDependent.has(member) ||
            externalRangesOn(member).some((range) => {
                const floor = rangeFloor(range);
                return floor !== null && semver.eq(floor, version);
            });
        // Whether a member could hold a version it does not hold today. When every
        // requester asks through an open range (`*`, `0.83 - 0.86`), its current
        // version is an accident of resolution rather than a constraint: the
        // resolver is free to land it elsewhere, and which version that is is not
        // ours to name. Anything exactly pinned, or pinned to the line it already
        // carries (`^0.87.0` on an 0.87.0), is not re-resolvable.
        const isReResolvable = (member) => {
            const ranges = externalRangesOn(member);
            if (ranges.length === 0)
                return true;
            const floors = ranges.map(rangeFloor);
            if (floors.includes(null))
                return false;
            const highestFloor = floors
                .filter((floor) => floor !== null)
                .toSorted((a, b) => semver.rcompare(a, b))[0];
            return (ranges.every((range) => accepts(highestFloor, range)) &&
                !isInstalled(member, highestFloor));
        };
        const duplicatedSet = new Set(duplicatedMembers);
        // Members that end up on `version`, as a fixed point: start from those free
        // to move — a duplicated one also has to already carry the version, since
        // the pure-lock pass copies an existing entry and never fetches — then drop
        // whoever an in-cluster requester pins elsewhere. Iterating matters because
        // such a requester only stops pinning if it converges too, and the family's
        // dependency edges run both ways.
        // Members whose version the resolver will choose: they hold a version the
        // family is leaving, and nothing pins them to it. Their current pins do not
        // block the family — the install round-trip moves them — but the version
        // they land on has to be verified afterwards, not asserted here.
        const floatingFor = (version) => new Set(clusterMembers.filter((member) => 
        // a duplicated member is what the fix is about: it converges or it
        // is excluded, never "the resolver will sort it out"
        !duplicatedSet.has(member) &&
            !isInstalled(member, version) &&
            !canReResolve(member, version) &&
            isReResolvable(member)));
        const convergentSetFor = (version, floating) => {
            const converging = new Set(clusterMembers.filter((member) => canMove(member, version) &&
                canReResolve(member, version) &&
                (!duplicatedSet.has(member) || isInstalled(member, version))));
            let settled = false;
            while (!settled) {
                settled = true;
                for (const member of converging) {
                    const pinnedElsewhere = (internalByMember.get(member) ?? []).some((internal) => !accepts(version, internal.range) &&
                        !converging.has(internal.requesterName) &&
                        !floating.has(internal.requesterName));
                    if (pinnedElsewhere) {
                        converging.delete(member);
                        settled = false;
                    }
                }
            }
            return converging;
        };
        const candidates = candidateVersions.map((version) => {
            const floating = floatingFor(version);
            const converging = convergentSetFor(version, floating);
            return {
                version,
                floatingMembers: [...floating].toSorted((a, b) => a.localeCompare(b)),
                // a pin the user would have to edit makes a candidate a last resort
                pinsToEdit: workspaceConstraints.filter((constraint) => !floating.has(constraint.packageName) &&
                    !accepts(version, constraint.range)),
                convergentMembers: duplicatedMembers.filter((member) => converging.has(member)),
                excluded: new Map(duplicatedMembers
                    .filter((member) => !converging.has(member))
                    .map((member) => [member, rejectingConstraints(member, version)])),
                installedCount: [...converging].filter((member) => isInstalled(member, version)).length,
            };
        });
        // The version an exact workspace pin fixes the family at, used to spot open
        // ranges that ignored it. Ambiguous pins (two members pinned to different
        // versions) anchor nothing. A pin is preferred, not immutable: a candidate
        // that violates one is ranked last, and proposed as a `workspaceChanges`
        // edit when nothing else deduplicates anything.
        const anchor = (() => {
            const pinned = new Set(exactWorkspacePins
                .filter((constraint) => isInstalled(constraint.packageName, constraint.range))
                .map((constraint) => constraint.range));
            return pinned.size === 1 ? [...pinned][0] : null;
        })();
        // Open ranges that accept the anchored version, carry the anchored version
        // in the lock, and still resolved somewhere else.
        const reuseFixes = anchor === null
            ? []
            : clusterMembers.flatMap((member) => isInstalled(member, anchor)
                ? (bindingByMember.get(member) ?? []).flatMap((constraint) => constraint.requesterName !== undefined &&
                    constraint.resolvedVersion !== undefined &&
                    !semver.eq(constraint.resolvedVersion, anchor) &&
                    accepts(anchor, constraint.range)
                    ? [
                        {
                            requester: constraint.requester,
                            requesterName: constraint.requesterName,
                            packageName: member,
                            range: constraint.range,
                            from: constraint.resolvedVersion,
                            to: anchor,
                        },
                    ]
                    : [])
                : []);
        let best;
        for (const candidate of candidates) {
            best = best ? betterCandidate(best, candidate) : candidate;
        }
        if (!best || best.convergentMembers.length === 0) {
            fixes.push({
                members: clusterMembers,
                duplicatedMembers,
                memberVersions,
                target: null,
                direction: "none",
                convergentMembers: [],
                driverMembers: [],
                excludedMembers: [],
                anchor,
                reuseFixes,
                floatingMembers: [],
                workspaceChanges: [],
                reResolutionSet: [],
                externalConstraints,
                needsRoundTrip: false,
                applicable: false,
            });
            continue;
        }
        const target = best.version;
        const workspaceChanges = best.pinsToEdit
            .filter((constraint) => canMove(constraint.packageName, target))
            .map((constraint) => ({ ...constraint, to: target }));
        // re-resolution set: members free to move that are pulled from outside the
        // cluster and do not carry the target version, so a pure-lock copy is
        // impossible. Internal-only members cascade from these.
        const floatingSet = new Set(best.floatingMembers);
        const reResolutionSet = clusterMembers
            .filter((member) => membersWithExternalDependent.has(member) &&
            !floatingSet.has(member) &&
            canMove(member, target) &&
            canReResolve(member, target) &&
            !isInstalled(member, target))
            .toSorted((a, b) => a.localeCompare(b));
        const replacedVersions = [
            ...best.convergentMembers,
            ...reResolutionSet,
        ].flatMap((member) => npmVersionsOf(member).filter((version) => !semver.eq(version, target)));
        fixes.push({
            members: clusterMembers,
            duplicatedMembers,
            memberVersions,
            target,
            direction: directionOf(replacedVersions, target),
            convergentMembers: best.convergentMembers,
            driverMembers: best.convergentMembers.filter(hasRealConstraint),
            excludedMembers: [...best.excluded].map(([packageName, blockedBy]) => ({
                packageName,
                blockedBy,
            })),
            anchor,
            reuseFixes,
            floatingMembers: best.floatingMembers,
            workspaceChanges,
            reResolutionSet,
            needsRoundTrip: reResolutionSet.length > 0 ||
                workspaceChanges.length > 0 ||
                best.floatingMembers.length > 0,
            externalConstraints,
            applicable: true,
        });
    }
    return fixes;
};
//# sourceMappingURL=identifyLockstepClusterFixes.js.map