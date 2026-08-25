import semver from "semver";
const createUnionFind = (names) => {
    const parent = new Map(names.map((name) => [name, name]));
    const find = (value) => {
        let root = value;
        while (parent.get(root) !== root) {
            root = parent.get(root);
        }
        let cursor = value;
        while (parent.get(cursor) !== root) {
            const next = parent.get(cursor);
            parent.set(cursor, root);
            cursor = next;
        }
        return root;
    };
    const union = (a, b) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) {
            parent.set(rootA, rootB);
        }
    };
    return { find, union };
};
// A dependency edge `A@version --(range)--> B` is "co-version" when the range
// is anchored on the same version A itself carries, regardless of the caret /
// tilde operator (`^8.61.0`, `8.61.0` and `~8.61.0` are all co-version with
// `8.61.0`). This distinguishes a lockstep-published family member from an
// ordinary external dependency such as `semver`/`debug`.
const isCoVersion = (version, range) => {
    const min = (() => {
        try {
            return semver.minVersion(range);
        }
        catch {
            return null;
        }
    })();
    return min !== null && semver.eq(min, version);
};
// Detect families of packages published in lockstep (versions move together)
// via union-find over the realized resolution graph. Names A and B are unioned
// when a real dependency edge A->B exists AND across every installed resolution
// where A requests B they carry the same version. Returns connected components
// of size > 1, members sorted, components ordered by their first member.
export const buildLockstepClusters = (graph) => {
    const names = Object.keys(graph);
    const unionFind = createUnionFind(names);
    for (const [name, resolutions] of Object.entries(graph)) {
        const observationsByDep = new Map();
        for (const resolution of resolutions) {
            if (!resolution.isNpm)
                continue;
            for (const [depName, range] of Object.entries(resolution.dependencies)) {
                if (depName === name)
                    continue;
                // edge must point to a package that actually exists in the lock
                if (!graph[depName])
                    continue;
                let observations = observationsByDep.get(depName);
                if (!observations) {
                    observations = [];
                    observationsByDep.set(depName, observations);
                }
                observations.push({ version: resolution.version, range });
            }
        }
        for (const [depName, observations] of observationsByDep) {
            const allCoVersion = observations.every((observation) => isCoVersion(observation.version, observation.range));
            if (allCoVersion) {
                unionFind.union(name, depName);
            }
        }
    }
    const componentsByRoot = new Map();
    for (const name of names) {
        const root = unionFind.find(name);
        let members = componentsByRoot.get(root);
        if (!members) {
            members = [];
            componentsByRoot.set(root, members);
        }
        members.push(name);
    }
    return [...componentsByRoot.values()]
        .filter((members) => members.length > 1)
        .map((members) => members.toSorted((a, b) => a.localeCompare(b)))
        .toSorted((a, b) => a[0].localeCompare(b[0]));
};
//# sourceMappingURL=buildLockstepClusters.js.map