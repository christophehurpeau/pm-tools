import { describe, expect, it } from "bun:test";
import { identifyLockstepClusterFixes } from "./identifyLockstepClusterFixes.js";
// A family published in lockstep: `root` is requested from outside and resolved
// high, `leaf` is duplicated because of it.
const members = {
    root: { npmVersions: ["2.0.0"], resolutionCount: 1 },
    leaf: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
};
const dependents = (entries) => new Map(entries.map(([name, list]) => [
    name,
    list.map((dependent) => ({
        requester: dependent.requester,
        requesterName: dependent.requesterName,
        range: dependent.range,
        resolvedVersion: dependent.resolvedVersion,
        workspace: dependent.workspace,
    })),
]));
const fixFor = (dependentsMap, map = members) => identifyLockstepClusterFixes([["leaf", "root"]], map, dependentsMap)[0];
describe("identifyLockstepClusterFixes", () => {
    it("collapses the duplicate onto the version its external range still accepts", () => {
        const fix = fixFor(dependents([
            [
                "root",
                [
                    {
                        requester: "outside@1",
                        requesterName: "outside",
                        range: "^1.0.0",
                    },
                ],
            ],
            [
                "leaf",
                [
                    // derived internal pin: discarded, it only exists because
                    // root@2.0.0 did
                    { requester: "root@2.0.0", requesterName: "root", range: "2.0.0" },
                    // the real reason leaf@1.0.0 is installed
                    { requester: "old@1", requesterName: "old", range: "^1.0.0" },
                ],
            ],
        ]));
        expect(fix.target).toBe("1.0.0");
        expect(fix.direction).toBe("down");
        expect(fix.duplicatedMembers).toEqual(["leaf"]);
        expect(fix.convergentMembers).toEqual(["leaf"]);
        expect(fix.excludedMembers).toEqual([]);
        expect(fix.externalConstraints).toEqual([
            {
                requester: "old@1",
                requesterName: "old",
                packageName: "leaf",
                range: "^1.0.0",
            },
            {
                requester: "outside@1",
                requesterName: "outside",
                packageName: "root",
                range: "^1.0.0",
            },
        ]);
        // root carries the external dependent and has no 1.0.0 installed
        expect(fix.reResolutionSet).toEqual(["root"]);
        expect(fix.needsRoundTrip).toBe(true);
        expect(fix.applicable).toBe(true);
    });
    it("treats an exact workspace pin as binding, never as an edit to propose", () => {
        const fix = fixFor(dependents([
            [
                "leaf",
                [
                    {
                        requester: "package.json",
                        range: "1.0.0",
                        resolvedVersion: "1.0.0",
                        workspace: { path: ".", depType: "devDependencies" },
                    },
                ],
            ],
        ]));
        // the pin is a decision: 2.0.0 is off the table for leaf, and 1.0.0 cannot
        // collapse either because root@2.0.0 is not asked to move by anyone
        expect(fix.workspaceChanges).toEqual([]);
        expect(fix.target).toBe("1.0.0");
        expect(fix.convergentMembers).toEqual(["leaf"]);
    });
    it("repoints an open range that ignored the pinned version", () => {
        const fix = fixFor(dependents([
            [
                "leaf",
                [
                    {
                        requester: "package.json",
                        range: "1.0.0",
                        resolvedVersion: "1.0.0",
                        workspace: { path: ".", depType: "devDependencies" },
                    },
                    {
                        requester: "plugin@1",
                        requesterName: "plugin",
                        range: "*",
                        resolvedVersion: "2.0.0",
                    },
                ],
            ],
        ]));
        expect(fix.anchor).toBe("1.0.0");
        expect(fix.reuseFixes).toEqual([
            {
                requester: "plugin@1",
                requesterName: "plugin",
                packageName: "leaf",
                range: "*",
                from: "2.0.0",
                to: "1.0.0",
            },
        ]);
    });
    it("excludes the member a third-party range rejects, keeping the rest", () => {
        const fix = identifyLockstepClusterFixes([["other", "leaf", "root"]], {
            ...members,
            other: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
        }, dependents([
            [
                "leaf",
                [{ requester: "user@1", requesterName: "user", range: "^2.0.0" }],
            ],
            [
                "other",
                [{ requester: "pinner@1", requesterName: "pinner", range: "~1.0.0" }],
            ],
        ]))[0];
        expect(fix.target).toBe("2.0.0");
        expect(fix.convergentMembers).toEqual(["leaf"]);
        expect(fix.excludedMembers).toEqual([
            {
                packageName: "other",
                blockedBy: [
                    {
                        requester: "pinner@1",
                        requesterName: "pinner",
                        packageName: "other",
                        range: "~1.0.0",
                    },
                ],
            },
        ]);
        expect(fix.applicable).toBe(true);
    });
    it("does not collapse a member an unmovable sibling pins elsewhere", () => {
        // `root` cannot leave 2.0.0 (exact third-party pin), and it requests leaf at
        // 2.0.0, so leaf's 1.0.0 copy cannot be collapsed onto 2.0.0 either.
        const fix = fixFor(dependents([
            [
                "root",
                [
                    {
                        requester: "outside@1",
                        requesterName: "outside",
                        range: "2.0.0",
                    },
                ],
            ],
            [
                "leaf",
                [
                    { requester: "root@2.0.0", requesterName: "root", range: "2.0.0" },
                    { requester: "old@1", requesterName: "old", range: "1.0.0" },
                ],
            ],
        ]));
        expect(fix.applicable).toBe(false);
        expect(fix.target).toBeNull();
        expect(fix.direction).toBe("none");
        expect(fix.convergentMembers).toEqual([]);
    });
    it("never targets a version the duplicated member does not carry", () => {
        const fix = fixFor(dependents([["leaf", []]]), {
            root: { npmVersions: ["3.0.0"], resolutionCount: 1 },
            leaf: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
        });
        // 3.0.0 is installed for root only: copying it over leaf is impossible
        expect(fix.target).toBe("2.0.0");
        expect(fix.direction).toBe("up");
    });
    it("proposes the pin change only when nothing else deduplicates", () => {
        // `other` is exactly pinned at 2.0.0 by a third party and requests leaf at
        // 2.0.0, so 1.0.0 collapses nothing; the workspace's own `~1.0.0` on leaf is
        // the only thing standing between the family and 2.0.0, so it is proposed.
        const fix = identifyLockstepClusterFixes([["leaf", "other"]], {
            leaf: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
            other: { npmVersions: ["2.0.0"], resolutionCount: 1 },
        }, dependents([
            [
                "leaf",
                [
                    {
                        requester: "package.json",
                        range: "~1.0.0",
                        resolvedVersion: "1.0.0",
                        workspace: { path: ".", depType: "devDependencies" },
                    },
                    {
                        requester: "other@2.0.0",
                        requesterName: "other",
                        range: "2.0.0",
                    },
                ],
            ],
            [
                "other",
                [{ requester: "app@1", requesterName: "app", range: "2.0.0" }],
            ],
        ]))[0];
        expect(fix.target).toBe("2.0.0");
        expect(fix.convergentMembers).toEqual(["leaf"]);
        expect(fix.workspaceChanges.map((change) => `${change.range} -> ${change.to}`)).toEqual(["~1.0.0 -> 2.0.0"]);
    });
    it("prefers a target that respects the workspace range over one that edits it", () => {
        // 1.0.0 collapses leaf without touching the workspace range, so the 2.0.0
        // candidate — which would need it widened — must not win.
        const fix = identifyLockstepClusterFixes([["leaf", "other"]], {
            leaf: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
            other: { npmVersions: ["1.0.0"], resolutionCount: 1 },
        }, dependents([
            [
                "leaf",
                [
                    {
                        requester: "package.json",
                        range: "~1.0.0",
                        resolvedVersion: "1.0.0",
                        workspace: { path: ".", depType: "devDependencies" },
                    },
                    { requester: "old@1", requesterName: "old", range: "^1.0.0" },
                ],
            ],
        ]))[0];
        expect(fix.target).toBe("1.0.0");
        expect(fix.workspaceChanges).toEqual([]);
    });
    it("lets the resolver move a member nothing pins, without naming a version", () => {
        // `holder` sits at 2.0.0 and pins leaf there, but its only requester asks
        // through `*`: it has to move for leaf to collapse onto 1.0.0, and which
        // version it lands on is the resolver's call.
        const fix = identifyLockstepClusterFixes([["holder", "leaf"]], {
            holder: { npmVersions: ["2.0.0"], resolutionCount: 1 },
            leaf: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
        }, dependents([
            ["holder", [{ requester: "app@1", requesterName: "app", range: "*" }]],
            [
                "leaf",
                [
                    {
                        requester: "holder@2.0.0",
                        requesterName: "holder",
                        range: "2.0.0",
                    },
                    { requester: "old@1", requesterName: "old", range: "1.0.0" },
                ],
            ],
        ]))[0];
        expect(fix.target).toBe("1.0.0");
        expect(fix.convergentMembers).toEqual(["leaf"]);
        expect(fix.floatingMembers).toEqual(["holder"]);
        // no version is claimed for a floating member
        expect(fix.reResolutionSet).toEqual([]);
        expect(fix.needsRoundTrip).toBe(true);
    });
    it("proposes the pin upgrade when the family is only pulled forward", () => {
        // The shape of a metro family under a pinned metro: a third party outside
        // the cluster requires `^2.0.0`, the workspace pins 1.0.0, and every member
        // carries both. Nothing collapses on 1.0.0 (the third party rules it out),
        // so the only solution left edits the pin.
        const fix = identifyLockstepClusterFixes([["family", "family-config"]], {
            family: { npmVersions: ["1.0.0", "2.0.0"], resolutionCount: 2 },
            "family-config": {
                npmVersions: ["1.0.0", "2.0.0"],
                resolutionCount: 2,
            },
        }, dependents([
            [
                "family",
                [
                    {
                        requester: "package.json",
                        range: "1.0.0",
                        resolvedVersion: "1.0.0",
                        workspace: { path: ".", depType: "devDependencies" },
                    },
                    { requester: "cli@2.0.0", requesterName: "cli", range: "^2.0.0" },
                    {
                        requester: "family-config@1.0.0",
                        requesterName: "family-config",
                        range: "1.0.0",
                    },
                    {
                        requester: "family-config@2.0.0",
                        requesterName: "family-config",
                        range: "2.0.0",
                    },
                ],
            ],
            [
                "family-config",
                [
                    { requester: "plugin@1", requesterName: "plugin", range: "*" },
                    {
                        requester: "family@1.0.0",
                        requesterName: "family",
                        range: "1.0.0",
                    },
                    {
                        requester: "family@2.0.0",
                        requesterName: "family",
                        range: "2.0.0",
                    },
                ],
            ],
        ]))[0];
        expect(fix.target).toBe("2.0.0");
        expect(fix.direction).toBe("up");
        expect(fix.convergentMembers).toEqual(["family", "family-config"]);
        expect(fix.driverMembers).toEqual(["family"]);
        expect(fix.workspaceChanges.map((change) => `${change.packageName} ${change.range} -> ${change.to}`)).toEqual(["family 1.0.0 -> 2.0.0"]);
    });
    it("skips a cluster with no duplicated member", () => {
        expect(identifyLockstepClusterFixes([["a", "b"]], {
            a: { npmVersions: ["1.0.0"], resolutionCount: 1 },
            b: { npmVersions: ["1.0.0"], resolutionCount: 1 },
        }, new Map())).toEqual([]);
    });
});
//# sourceMappingURL=identifyLockstepClusterFixes.test.js.map