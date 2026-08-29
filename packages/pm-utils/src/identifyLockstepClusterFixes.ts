import semver from "semver";

// Where a workspace requester declares the range, for appliers that have to
// edit it back. Only set for importer (workspace) dependents.
export interface ClusterWorkspaceRef {
  path: string;
  depType: string;
}

export interface ClusterExternalConstraint {
  // display key of the requester
  requester: string;
  // npm name of the requester, or undefined for a workspace/importer requester
  requesterName: string | undefined;
  packageName: string;
  range: string;
  // the requester declares the package under a key naming another package, which
  // some package managers' overrides cannot repoint
  isAlias?: boolean;
  // version this requester actually got, when the lockfile records it
  resolvedVersion?: string;
  workspace?: ClusterWorkspaceRef;
}

// A workspace pin that has to be edited for the cluster to converge.
export interface ClusterWorkspaceChange extends ClusterExternalConstraint {
  to: string;
}

// A member kept out of the convergence by one of its own third-party
// constraints; its duplicate survives the fix.
export interface ClusterExcludedMember {
  packageName: string;
  blockedBy: ClusterExternalConstraint[];
}

// One cluster member, reduced to what target selection needs.
export interface ClusterMember {
  npmVersions: string[];
  resolutionCount: number;
}

// name -> installed state. Package-manager packages adapt their own lockfile
// model into this neutral shape.
export type ClusterMembersMap = Record<string, ClusterMember>;

export interface ClusterDependent {
  requester: string;
  requesterName: string | undefined;
  range: string;
  // see `ClusterExternalConstraint.isAlias`
  isAlias?: boolean;
  workspace?: ClusterWorkspaceRef;
  // version this requester actually got, when the lockfile records it
  resolvedVersion?: string;
  // see `ResolutionDependent.nonSemver`: reported, never weighed
  nonSemver?: boolean;
}

export type ClusterDependentsMap = Map<string, ClusterDependent[]>;

// An open range that resolved away from the version the workspace pins the
// family at, although the range accepts it. Nothing to collapse — both copies
// have other dependents — but the requester is using a different copy than the
// workspace does, which for a plugin of the pinned package is a mismatch.
export interface ClusterReuseFix {
  requester: string;
  requesterName: string;
  packageName: string;
  range: string;
  from: string;
  to: string;
}

// What a member currently has installed. `nonNpmCount` is how many of its
// resolutions are not npm ones (git, file, …), which carry no comparable
// version but still exist in the tree.
export interface ClusterMemberVersions {
  versions: string[];
  nonNpmCount: number;
}

export interface ClusterFix {
  members: string[];
  duplicatedMembers: string[];
  // installed versions per member, for display
  memberVersions: Record<string, ClusterMemberVersions>;
  // null when no candidate version lets any duplicated member converge
  target: string | null;
  // how the members that move reach the target; "same" when nothing moves
  direction: "down" | "none" | "same" | "up";
  // duplicated members that do converge on the target
  convergentMembers: string[];
  // the convergent members a real constraint applies to. The rest are dragged
  // along by an open range (`*`) or by a sibling's pin: they carry no decision
  // of their own and follow whatever these resolve to
  driverMembers: string[];
  // members whose own third-party constraints reject the target: they keep
  // their resolutions, and their duplicates with them
  excludedMembers: ClusterExcludedMember[];
  // exact version a workspace pin fixes the family at, if any. It anchors
  // `reuseFixes`; it does not make the pin immutable — see `workspaceChanges`
  anchor: string | null;
  // open ranges that could have reused the anchored version and did not
  reuseFixes: ClusterReuseFix[];
  // members the package manager has to re-resolve, at a version only it can
  // pick: nothing pins them, so the result has to be verified after installing
  floatingMembers: string[];
  // workspace ranges to widen before installing. Only non-exact ones: an exact
  // pin is a decision, and is treated as immutable
  workspaceChanges: ClusterWorkspaceChange[];
  // members that must be re-resolved through an install round-trip because they
  // carry an external dependent and the target version is not installed
  reResolutionSet: string[];
  externalConstraints: ClusterExternalConstraint[];
  // true when the fix cannot be applied by a lockfile rewrite alone
  needsRoundTrip: boolean;
  // false when no duplicated member can converge. `reuseFixes` is independent:
  // a cluster can be unfixable as a whole and still have open ranges to repoint
  applicable: boolean;
}

const accepts = (version: string, range: string): boolean =>
  semver.satisfies(version, range, { includePrerelease: true });

interface Candidate {
  version: string;
  // duplicated members that collapse onto this version
  convergentMembers: string[];
  // duplicated members that do not, with the third-party ranges to blame
  excluded: Map<string, ClusterExternalConstraint[]>;
  // members the resolver has to move, version unknown
  floatingMembers: string[];
  // workspace pins that would have to be edited to reach this version
  pinsToEdit: ClusterExternalConstraint[];
  // members this version is installed for, among those free to move
  installedCount: number;
}

// Prefer a candidate that needs no edit to the user's own package.json — a pin
// is a decision, so changing it is a last resort, taken only when nothing else
// deduplicates anything. Then the candidate that deduplicates the most members,
// then the one already installed for the most of them (a version the lockfile
// never mentions for a member is a far weaker proposal), then the highest.
const betterCandidate = (a: Candidate, b: Candidate): Candidate => {
  const aRespectsPins =
    a.pinsToEdit.length === 0 && a.convergentMembers.length > 0;
  const bRespectsPins =
    b.pinsToEdit.length === 0 && b.convergentMembers.length > 0;
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

const directionOf = (
  replacedVersions: string[],
  target: string,
): ClusterFix["direction"] => {
  if (replacedVersions.length === 0) return "same";
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
export const identifyLockstepClusterFixes = (
  clusters: string[][],
  members: ClusterMembersMap,
  dependents: ClusterDependentsMap,
): ClusterFix[] => {
  const fixes: ClusterFix[] = [];

  for (const clusterMembers of clusters) {
    const memberSet = new Set(clusterMembers);
    const npmVersionsOf = (member: string): string[] =>
      members[member]?.npmVersions ?? [];

    const duplicatedMembers = clusterMembers.filter(
      (member) => (members[member]?.resolutionCount ?? 0) > 1,
    );
    // a cluster with no duplicated member has nothing to dedupe
    if (duplicatedMembers.length === 0) continue;

    const memberVersions = Object.fromEntries(
      clusterMembers.map((member) => {
        const versions = npmVersionsOf(member);
        return [
          member,
          {
            versions,
            nonNpmCount: Math.max(
              (members[member]?.resolutionCount ?? 0) - versions.length,
              0,
            ),
          },
        ];
      }),
    );

    const externalConstraints: ClusterExternalConstraint[] = [];
    // third-party ranges: the only ones that can rule a version out. A workspace
    // range belongs to the user, so it never blocks — it is ranked against
    // instead (`pinsToEdit`), and proposed for editing only when nothing else
    // deduplicates anything.
    const bindingByMember = new Map<string, ClusterExternalConstraint[]>();
    const internalByMember = new Map<
      string,
      { requesterName: string; range: string }[]
    >();
    const workspaceConstraints: ClusterExternalConstraint[] = [];
    const exactWorkspacePins: ClusterExternalConstraint[] = [];
    const membersWithExternalDependent = new Set<string>();

    for (const member of clusterMembers) {
      for (const dependent of dependents.get(member) ?? []) {
        // a range semver cannot read rules no version in or out; counted as an
        // external constraint it would block every convergence it touches
        if (dependent.nonSemver) continue;

        const isInternal =
          dependent.requesterName !== undefined &&
          memberSet.has(dependent.requesterName);
        if (isInternal) {
          const forMember = internalByMember.get(member) ?? [];
          forMember.push({
            requesterName: dependent.requesterName!,
            range: dependent.range,
          });
          internalByMember.set(member, forMember);
          continue;
        }

        const constraint: ClusterExternalConstraint = {
          requester: dependent.requester,
          requesterName: dependent.requesterName,
          packageName: member,
          range: dependent.range,
          isAlias: dependent.isAlias,
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
        } else {
          const forMember = bindingByMember.get(member);
          if (forMember) {
            forMember.push(constraint);
          } else {
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
    const rejectingConstraints = (
      member: string,
      version: string,
    ): ClusterExternalConstraint[] =>
      (bindingByMember.get(member) ?? []).filter(
        (constraint) => !accepts(version, constraint.range),
      );

    const canMove = (member: string, version: string): boolean =>
      rejectingConstraints(member, version).length === 0;

    const isInstalled = (member: string, version: string): boolean =>
      npmVersionsOf(member).some((installed) => semver.eq(installed, version));

    // A range that accepts every version the member has installed expresses no
    // preference: it cannot be the reason two copies exist, and it follows
    // whatever the family resolves to.
    const isOpenRange = (member: string, range: string): boolean =>
      npmVersionsOf(member).every((version) => accepts(version, range));

    const hasRealConstraint = (member: string): boolean =>
      [
        ...(bindingByMember.get(member) ?? []),
        ...workspaceConstraints.filter(
          (constraint) => constraint.packageName === member,
        ),
      ].some((constraint) => !isOpenRange(member, constraint.range));

    const externalRangesOn = (member: string): string[] =>
      [
        ...(bindingByMember.get(member) ?? []),
        ...workspaceConstraints.filter(
          (constraint) => constraint.packageName === member,
        ),
      ].map((constraint) => constraint.range);

    const rangeFloor = (range: string): string | null => {
      try {
        return semver.minVersion(range)?.version ?? null;
      } catch {
        return null;
      }
    };

    // Re-resolving a member *to a named version* absent from the lock only makes
    // sense when a dependent asks for that version line: `^8.59.1` is evidence
    // that 8.59.1 exists, `*` and `0.83 - 0.86` are not. Without this, any
    // externally-requested member looks free to move anywhere its ranges happen
    // to admit — which is how a react-native@0.87.0 pulled into a metro cluster
    // ends up "converging" on a metro version number.
    const canReResolve = (member: string, version: string): boolean =>
      isInstalled(member, version) ||
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
    const isReResolvable = (member: string): boolean => {
      const ranges = externalRangesOn(member);
      if (ranges.length === 0) return true;

      const floors = ranges.map(rangeFloor);
      if (floors.includes(null)) return false;

      const highestFloor = floors
        .filter((floor): floor is string => floor !== null)
        .toSorted((a, b) => semver.rcompare(a, b))[0]!;

      return (
        ranges.every((range) => accepts(highestFloor, range)) &&
        !isInstalled(member, highestFloor)
      );
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
    const floatingFor = (version: string): Set<string> =>
      new Set(
        clusterMembers.filter(
          (member) =>
            // a duplicated member is what the fix is about: it converges or it
            // is excluded, never "the resolver will sort it out"
            !duplicatedSet.has(member) &&
            !isInstalled(member, version) &&
            !canReResolve(member, version) &&
            isReResolvable(member),
        ),
      );

    const convergentSetFor = (
      version: string,
      floating: Set<string>,
    ): Set<string> => {
      const converging = new Set(
        clusterMembers.filter(
          (member) =>
            canMove(member, version) &&
            canReResolve(member, version) &&
            (!duplicatedSet.has(member) || isInstalled(member, version)),
        ),
      );

      let settled = false;
      while (!settled) {
        settled = true;
        for (const member of converging) {
          const pinnedElsewhere = (internalByMember.get(member) ?? []).some(
            (internal) =>
              !accepts(version, internal.range) &&
              !converging.has(internal.requesterName) &&
              !floating.has(internal.requesterName),
          );
          if (pinnedElsewhere) {
            converging.delete(member);
            settled = false;
          }
        }
      }

      return converging;
    };

    const candidates = candidateVersions.map((version): Candidate => {
      const floating = floatingFor(version);
      const converging = convergentSetFor(version, floating);

      return {
        version,
        floatingMembers: [...floating].toSorted((a, b) => a.localeCompare(b)),
        // a pin the user would have to edit makes a candidate a last resort
        pinsToEdit: workspaceConstraints.filter(
          (constraint) =>
            !floating.has(constraint.packageName) &&
            !accepts(version, constraint.range),
        ),
        convergentMembers: duplicatedMembers.filter((member) =>
          converging.has(member),
        ),
        excluded: new Map<string, ClusterExternalConstraint[]>(
          duplicatedMembers
            .filter((member) => !converging.has(member))
            .map((member) => [member, rejectingConstraints(member, version)]),
        ),
        installedCount: [...converging].filter((member) =>
          isInstalled(member, version),
        ).length,
      };
    });

    // The version an exact workspace pin fixes the family at, used to spot open
    // ranges that ignored it. Ambiguous pins (two members pinned to different
    // versions) anchor nothing. A pin is preferred, not immutable: a candidate
    // that violates one is ranked last, and proposed as a `workspaceChanges`
    // edit when nothing else deduplicates anything.
    const anchor = ((): string | null => {
      const pinned = new Set(
        exactWorkspacePins
          .filter((constraint) =>
            isInstalled(constraint.packageName, constraint.range),
          )
          .map((constraint) => constraint.range),
      );
      return pinned.size === 1 ? [...pinned][0]! : null;
    })();

    // Open ranges that accept the anchored version, carry the anchored version
    // in the lock, and still resolved somewhere else.
    const reuseFixes: ClusterReuseFix[] =
      anchor === null
        ? []
        : clusterMembers.flatMap((member) =>
            isInstalled(member, anchor)
              ? (bindingByMember.get(member) ?? []).flatMap((constraint) =>
                  constraint.requesterName !== undefined &&
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
                    : [],
                )
              : [],
          );

    let best: Candidate | undefined;
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
      .filter(
        (member) =>
          membersWithExternalDependent.has(member) &&
          !floatingSet.has(member) &&
          canMove(member, target) &&
          canReResolve(member, target) &&
          !isInstalled(member, target),
      )
      .toSorted((a, b) => a.localeCompare(b));

    const replacedVersions = [
      ...best.convergentMembers,
      ...reResolutionSet,
    ].flatMap((member) =>
      npmVersionsOf(member).filter((version) => !semver.eq(version, target)),
    );

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
      needsRoundTrip:
        reResolutionSet.length > 0 ||
        workspaceChanges.length > 0 ||
        best.floatingMembers.length > 0,
      externalConstraints,
      applicable: true,
    });
  }

  return fixes;
};
