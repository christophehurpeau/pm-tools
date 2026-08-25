import semver from "semver";
const accepts = (version, range) => {
    try {
        return semver.satisfies(version, range, { includePrerelease: true });
    }
    catch {
        // a selector semver cannot read (`npm:`, a git url) says nothing about the
        // version, so it is no reason to drop the override
        return true;
    }
};
/**
 * Split the planned overrides for a package manager whose overrides apply to
 * every requester of the package, whatever range it declares (bun's
 * `overrides`, pnpm's plain ones). Such an override cannot spare the dependents
 * a conditional one would — pnpm's convergence overrides only repoint the edges
 * that accept the version — so one a third-party range rejects would force that
 * dependent onto a version it never allowed.
 *
 * The `converge` overrides are safe by construction: the detector only converges
 * a member no third-party range holds elsewhere. A `reuse` override is derived
 * from a single requester's range, and another requester can still reject it.
 */
export const partitionUnconditionalOverrides = (fixes, overrides) => {
    const constraints = fixes.flatMap((fix) => fix.externalConstraints);
    const safe = [];
    const rejected = [];
    for (const override of overrides) {
        const rejectedBy = constraints.filter((constraint) => constraint.packageName === override.packageName &&
            constraint.requesterName !== undefined &&
            !accepts(override.version, constraint.range));
        if (rejectedBy.length === 0) {
            safe.push(override);
        }
        else {
            rejected.push({ override, rejectedBy });
        }
    }
    return { safe, rejected };
};
//# sourceMappingURL=unconditionalOverrides.js.map