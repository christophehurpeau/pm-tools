import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
/**
 * The descriptor as the lockfile keys it. A manifest declares a bare range
 * (`"^5.0.7"`) where yarn writes the protocol it means (`npm:^5.0.7`), so a
 * range read from a workspace manifest only finds its entry once normalised.
 */
const lockfileKey = (descriptor) => {
    const [key, value] = PackageDependencyDescriptorUtils.stringify({
        ...descriptor,
        protocol: descriptor.protocol ?? "npm",
    });
    return `${key}@${value}`;
};
/**
 * yarn writes a `patch:` entry for every package it patches — its builtin
 * compat layer alone accounts for most of them — and that entry repeats the
 * base release's `dependencies` verbatim. Counted twice, one constraint would
 * be reported twice and read as two requesters. Identity is therefore the
 * constraint itself: who asks, for what, at which range.
 *
 * Which block the range sits in is deliberately not part of it: a package may
 * declare the same name as both a dependency and a peer (yarn's
 * peer-with-default), and at the same range that is one constraint, not two.
 */
const constraintKey = (requesterName, dependent) => `${requesterName ?? ""}>${dependent.aliasKey ?? ""}@${dependent.version}>${dependent.workspace?.depType ?? ""}`;
export const collectYarnDependents = ({ packages, workspaces, onlyPackageNames, }) => {
    const dependentsMap = new Map();
    const seen = new Map();
    const add = (npmName, requesterName, dependent) => {
        let seenForPackage = seen.get(npmName);
        if (!seenForPackage) {
            seenForPackage = new Set();
            seen.set(npmName, seenForPackage);
        }
        const key = constraintKey(requesterName, dependent);
        if (seenForPackage.has(key))
            return;
        seenForPackage.add(key);
        let dependents = dependentsMap.get(npmName);
        if (!dependents) {
            dependents = [];
            dependentsMap.set(npmName, dependents);
        }
        dependents.push(dependent);
    };
    const iterateDependencies = ({ dependencies, requesterKey, requesterName, yarnPackage, workspace, peer, }) => {
        for (const [depKey, depValue] of dependencies) {
            const descriptor = PackageDependencyDescriptorUtils.parse(depKey, depValue);
            if (onlyPackageNames && !onlyPackageNames.includes(descriptor.npmName)) {
                continue;
            }
            // A `workspace:`, `patch:`, `file:` or git declaration names a different
            // package that happens to share this key, so it constrains no npm
            // version, and it is flagged rather than read as a range: taken as one,
            // `semver.satisfies` would answer "not satisfied" for every candidate and
            // suppress the merges the real dependents allow. It is still recorded —
            // a `patch:` copy is a resolution of its own in the report, and dropping
            // the only declaration that asks for it leaves that copy with no
            // explanation at all. The declaration is kept as written, protocol
            // included, there being no range to keep instead.
            const nonSemver = isSemverComparable(descriptor) ? undefined : true;
            // yarn keys its lockfile by the descriptor the requester declared, so the
            // version it actually got is one exact lookup — no install-path walk.
            // A peer range is not a descriptor yarn resolves, so the lookup only
            // answers when something else happens to declare that same range; the
            // version a peer requester was handed is its parent's business and is
            // left unattributed rather than guessed at.
            const resolved = packages.get(lockfileKey(descriptor));
            add(descriptor.npmName, requesterName, {
                key: requesterKey,
                version: nonSemver
                    ? PackageDependencyDescriptorUtils.stringify(descriptor)[1]
                    : descriptor.selector,
                aliasKey: descriptor.isAlias ? descriptor.key : undefined,
                yarnPackage,
                workspace,
                resolvedVersion: resolved?.type === "npm" ? resolved.version : undefined,
                resolvedResolution: resolved && resolved.type !== "npm" ? resolved.resolution : undefined,
                peer,
                nonSemver,
            });
        }
    };
    for (const workspace of workspaces) {
        const workspaceName = workspace.path === "" ? "package.json" : workspace.path;
        for (const { key, value, depType } of workspace.dependencies) {
            iterateDependencies({
                dependencies: [[key, value]],
                requesterKey: `${workspaceName} in ${depType}`,
                workspace: { path: workspace.path, depType },
            });
        }
    }
    const visited = new Set();
    for (const yarnPackage of packages.values()) {
        if (visited.has(yarnPackage))
            continue;
        visited.add(yarnPackage);
        // workspaces are read from their manifests instead: the lockfile folds
        // their dependencies and devDependencies into one map, losing the block an
        // edit would have to target
        if (yarnPackage.type === "other" && yarnPackage.protocol === "workspace") {
            continue;
        }
        iterateDependencies({
            dependencies: Object.entries(yarnPackage.entry.dependencies ?? {}),
            requesterKey: yarnPackage.resolution,
            requesterName: yarnPackage.name,
            yarnPackage,
        });
        // A peer range constrains the version its requester ends up using just as a
        // dependency range does — yarn folds the peer provision into the virtual
        // package's own `dependencies` (`Project.js`, `virtualizedPackage
        // .dependencies.set(peerDescriptor.identHash, peerProvision)`), which is why
        // `yarn why` lists peer requesters. Only the resolved tree carries that
        // fold: `generateLockfile` skips virtual packages, so the lockfile keeps the
        // peer ranges in a block of their own and reading `dependencies` alone
        // misses them. Left out, `@babel/core` looks unconstrained by the fifty
        // `@babel/plugin-*` that peer-depend on it, and a merge those ranges forbid
        // is proposed as if nothing objected.
        //
        // Peers declared optional are kept too. Whether one was actually provided
        // is not in the lockfile, so the choice is between a constraint that may not
        // bind and a merge that may break a peer yarn does provide; suppressing a
        // merge is the cheaper mistake. Workspace manifests are read for their
        // dependency blocks only — a workspace's own peer range is a contract for
        // its consumers, not a request for a copy in this project.
        iterateDependencies({
            dependencies: Object.entries(yarnPackage.entry.peerDependencies ?? {}),
            requesterKey: yarnPackage.resolution,
            requesterName: yarnPackage.name,
            yarnPackage,
            peer: true,
        });
    }
    return dependentsMap;
};
//# sourceMappingURL=collectYarnDependents.js.map