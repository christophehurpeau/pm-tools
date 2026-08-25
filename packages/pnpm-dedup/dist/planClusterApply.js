/**
 * Turn the detector's records into the two edits pnpm understands:
 *
 * - a `workspaceChanges` entry is a range the user declares, so it is edited in
 *   place in the importer's `package.json`;
 * - everything else is a transitive edge, which only an override can repoint.
 *   Convergence overrides (`"pkg@": "1.2.3"`) are used rather than plain ones:
 *   they rewrite an edge only where the declared range accepts the version, so
 *   the members `excludedMembers` spares keep their own resolution instead of
 *   being forced onto a version their dependent rejects.
 *
 * `reuseFixes` come first: they converge on `anchor`, the version the user
 * pinned, and a pin outranks a version the detector merely computed.
 */
export const planClusterApply = (fixes) => {
    const manifestEdits = [];
    const unresolvableChanges = [];
    const conflicts = [];
    const overrides = new Map();
    const addOverride = (packageName, version, reason) => {
        const existing = overrides.get(packageName);
        if (existing) {
            if (existing.version !== version) {
                conflicts.push({
                    packageName,
                    kept: existing.version,
                    dropped: version,
                });
            }
            return;
        }
        overrides.set(packageName, { packageName, version, reason });
    };
    for (const fix of fixes) {
        for (const reuse of fix.reuseFixes) {
            addOverride(reuse.packageName, reuse.to, "reuse");
        }
    }
    for (const fix of fixes) {
        if (!fix.applicable || fix.target === null)
            continue;
        for (const change of fix.workspaceChanges) {
            if (!change.workspace) {
                unresolvableChanges.push(`${change.packageName} in ${change.requester}`);
                continue;
            }
            manifestEdits.push({
                importerPath: change.workspace.path,
                depType: change.workspace.depType,
                packageName: change.packageName,
                range: change.range,
                to: change.to,
            });
        }
        for (const member of [...fix.convergentMembers, ...fix.reResolutionSet]) {
            addOverride(member, fix.target, "converge");
        }
    }
    return {
        manifestEdits,
        overrides: [...overrides.values()].toSorted((a, b) => a.packageName.localeCompare(b.packageName)),
        conflicts,
        unresolvableChanges,
    };
};
//# sourceMappingURL=planClusterApply.js.map