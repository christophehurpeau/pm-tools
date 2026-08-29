/**
 * Every version a package resolves to in a lockfile, by package name.
 *
 * The duplicate snapshot only carries the resolutions of packages that have
 * several, so it cannot name the version a merge landed on: once a package is
 * deduplicated it leaves the snapshot altogether. Saying what a run deduped
 * needs the whole picture, before and after.
 */
export type VersionsSnapshot = Map<string, string[]>;
/**
 * The shape every package manager's parsed package already has. `version` is
 * only there for npm resolutions — a `git:` or `file:` copy is identified by its
 * resolution instead, which is unique per install just the same.
 */
export interface SnapshotPackage {
    type: string;
    name: string;
    resolution: string;
    version?: string;
}
export declare const buildVersionsSnapshot: (packages: Iterable<SnapshotPackage>) => VersionsSnapshot;
export interface DedupedPackage {
    packageName: string;
    before: string[];
    after: string[];
}
/**
 * What the two snapshots say a run collapsed, one entry per package: both sides
 * whole, so a family converging on an older release reads as the two copies
 * becoming one rather than as a downgrade.
 *
 * Only a package resolved fewer times than before is reported. A version that
 * moved without a copy going away is a re-resolution, not a dedupe — the pass
 * that made the edit already said so — and a package that left the lockfile
 * entirely is neither: the in-memory rewrite drops the private subtrees of the
 * versions it replaced, entries the next install resolves again.
 */
export declare const diffVersionsSnapshots: (before: VersionsSnapshot, after: VersionsSnapshot) => DedupedPackage[];
export declare const countDuplicatedPackages: (snapshot: VersionsSnapshot) => number;
//# sourceMappingURL=versionsSnapshot.d.ts.map