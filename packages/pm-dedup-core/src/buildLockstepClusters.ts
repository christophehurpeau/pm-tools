import semver from "semver";

// One installed resolution of a package, reduced to what cluster detection
// needs. `dependencies` maps a dependency name to either a requested range
// (bun stores `^8.61.0`) or a resolved version (pnpm snapshots store `8.61.0`);
// both are handled by anchoring on the minimum version.
export interface LockstepResolution {
  version: string;
  isNpm: boolean;
  dependencies: Record<string, string>;
}

// name -> installed resolutions. Package-manager packages adapt their own
// lockfile model into this neutral shape.
export type LockstepGraph = Record<string, LockstepResolution[]>;

interface UnionFind {
  find: (value: string) => string;
  union: (a: string, b: string) => void;
}

const createUnionFind = (names: string[]): UnionFind => {
  const parent = new Map<string, string>(names.map((name) => [name, name]));

  const find = (value: string): string => {
    let root = value;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let cursor = value;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };

  const union = (a: string, b: string): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  };

  return { find, union };
};

// npm versions installed for each name, normalized, for anchor lookups.
const collectNpmVersions = (graph: LockstepGraph): Map<string, Set<string>> => {
  const versionsByName = new Map<string, Set<string>>();

  for (const [name, resolutions] of Object.entries(graph)) {
    const versions = new Set<string>();
    for (const resolution of resolutions) {
      if (!resolution.isNpm) continue;
      const parsed = semver.parse(resolution.version);
      if (parsed) versions.add(parsed.version);
    }
    versionsByName.set(name, versions);
  }

  return versionsByName;
};

// A dependency edge `A@version --(range)--> B` is "co-version" when the range
// is anchored on the same version A itself carries, regardless of the caret /
// tilde operator (`^8.61.0`, `8.61.0` and `~8.61.0` are all co-version with
// `8.61.0`). This distinguishes a lockstep-published family member from an
// ordinary external dependency such as `semver`/`debug`.
//
// The anchor also has to be a version of B the lock actually installs, or the
// equality is a coincidence rather than a lockstep pin: `d@1.0.1` requesting
// `type@^1.0.1` anchors on `1.0.1`, yet the only installed `type` versions are
// `1.2.0` and `2.7.2`, so `d` and `type` do not move together. Lockfiles that
// store resolved versions instead of ranges (pnpm) satisfy this by
// construction; it brings the range-storing ones in line.
const isCoVersion = (
  version: string,
  range: string,
  depVersions: Set<string>,
): boolean => {
  const min = (() => {
    try {
      return semver.minVersion(range);
    } catch {
      return null;
    }
  })();
  if (min === null) return false;
  return semver.eq(min, version) && depVersions.has(min.version);
};

// Detect families of packages published in lockstep (versions move together)
// via union-find over the realized resolution graph. Names A and B are unioned
// when a real dependency edge A->B exists AND across every installed resolution
// where A requests B they carry the same version, that version being one the
// lock installs for B. Returns connected components
// of size > 1, members sorted, components ordered by their first member.
export const buildLockstepClusters = (graph: LockstepGraph): string[][] => {
  const names = Object.keys(graph);
  const unionFind = createUnionFind(names);
  const versionsByName = collectNpmVersions(graph);

  for (const [name, resolutions] of Object.entries(graph)) {
    const observationsByDep = new Map<
      string,
      { version: string; range: string }[]
    >();

    for (const resolution of resolutions) {
      if (!resolution.isNpm) continue;

      for (const [depName, range] of Object.entries(resolution.dependencies)) {
        if (depName === name) continue;
        // edge must point to a package that actually exists in the lock
        if (!graph[depName]) continue;

        let observations = observationsByDep.get(depName);
        if (!observations) {
          observations = [];
          observationsByDep.set(depName, observations);
        }
        observations.push({ version: resolution.version, range });
      }
    }

    for (const [depName, observations] of observationsByDep) {
      const depVersions = versionsByName.get(depName) ?? new Set<string>();
      const allCoVersion = observations.every((observation) =>
        isCoVersion(observation.version, observation.range, depVersions),
      );
      if (allCoVersion) {
        unionFind.union(name, depName);
      }
    }
  }

  const componentsByRoot = new Map<string, string[]>();
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
    .toSorted((a, b) => a[0]!.localeCompare(b[0]!));
};
