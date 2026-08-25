import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { renderDuplicatesReport } from "./renderDuplicatesReport.js";
const escapeStart = "\u001B[";
const metroPin = {
    requester: "package.json in devDependencies",
    requesterName: undefined,
    packageName: "metro",
    range: "0.84.5",
};
const clusterFix = (overrides = {}) => ({
    members: ["metro", "metro-config"],
    duplicatedMembers: ["metro", "metro-config"],
    memberVersions: {
        metro: { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
        "metro-config": { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
    },
    target: "0.87.0",
    direction: "up",
    convergentMembers: ["metro", "metro-config"],
    driverMembers: ["metro"],
    excludedMembers: [],
    anchor: null,
    reuseFixes: [],
    floatingMembers: [],
    workspaceChanges: [],
    reResolutionSet: ["metro"],
    externalConstraints: [metroPin],
    needsRoundTrip: true,
    applicable: true,
    ...overrides,
});
const metroPackage = (overrides = {}) => ({
    packageName: "metro",
    resolutions: [
        { resolution: "metro@0.84.5", installations: ["metro@0.84.5"] },
        { resolution: "metro@0.87.0", installations: ["metro@0.87.0"] },
    ],
    dependents: [
        { requester: "package.json in devDependencies", range: "0.84.5" },
    ],
    dedupe: [],
    ...overrides,
});
const render = (overrides = {}) => {
    let buffer = "";
    renderDuplicatesReport({
        title: "duplicates",
        packages: [metroPackage()],
        totalDependencies: 120,
        dedupeCommand: "pnpm-dedupe",
        color: false,
        log: (message = "") => {
            buffer += `${message}\n`;
        },
        ...overrides,
    });
    return buffer;
};
const lastLine = (output) => output.trimEnd().split("\n").at(-1);
describe("renderDuplicatesReport", () => {
    it("renders resolutions and dependents", () => {
        const output = render();
        ok(output.startsWith("Found 1 duplicate:\n"));
        ok(output.includes("metro:"));
        ok(output.includes("  Resolutions:"));
        ok(output.includes("    - metro@0.84.5"));
        ok(output.includes("  Dependents:"));
        ok(output.includes('    - package.json in devDependencies requires "0.84.5"'));
    });
    it("lists the installation contexts of a shared resolution", () => {
        const output = render({
            packages: [
                metroPackage({
                    resolutions: [
                        {
                            resolution: "metro@0.84.5",
                            installations: ["metro@0.84.5", "metro@0.84.5(react@19)"],
                        },
                    ],
                }),
            ],
        });
        ok(output.includes("      Installed at:"));
        ok(output.includes("        - metro@0.84.5(react@19)"));
    });
    it("states how a duplicate would collapse", () => {
        const output = render({
            packages: [
                metroPackage({ dedupe: [{ from: ["0.84.5"], to: "0.87.0" }] }),
            ],
        });
        ok(output.includes("  Dedupe:"));
        ok(output.includes("    - 0.84.5 -> 0.87.0"));
    });
    it("reports no duplicates for an empty list", () => {
        const output = render({ packages: [] });
        ok(output.startsWith("No duplicates found\n"));
        strictEqual(lastLine(output), "Found 120 dependencies, 0 duplicates, 0 dedupable.");
    });
    it("omits the command when nothing is dedupable", () => {
        ok(!render().includes("pnpm-dedupe"));
    });
    it("counts a cluster-only dedupable in the summary", () => {
        const output = render({ clusterFixes: [clusterFix()] });
        strictEqual(lastLine(output), "Found 120 dependencies, 1 duplicate, 2 dedupable. Run `pnpm-dedupe` to apply.");
    });
    it("counts a package that is both its own fix and a cluster member once", () => {
        const output = render({
            packages: [
                metroPackage({ dedupe: [{ from: ["0.84.5"], to: "0.87.0" }] }),
            ],
            clusterFixes: [clusterFix()],
        });
        ok(lastLine(output).includes("2 dedupable"));
    });
    it("explains what a cluster is, once", () => {
        const output = render({ clusterFixes: [clusterFix(), clusterFix()] });
        ok(output.includes("Lockstep clusters:"));
        strictEqual(output.split("A lockstep cluster is a family of packages").length - 1, 1);
    });
    it("cross-references a member to its cluster", () => {
        const output = render({ clusterFixes: [clusterFix()] });
        ok(output.includes("  Cluster: 1"));
        ok(output.includes("cluster 1 — metro* [2 packages, 2 duplicated, 2 fixable]:"));
    });
    it("lists every member with its installed versions", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    members: ["metro", "metro-config-with-a-long-name"],
                    memberVersions: {
                        metro: { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
                        "metro-config-with-a-long-name": {
                            versions: ["0.87.0"],
                            nonNpmCount: 0,
                        },
                    },
                }),
            ],
        });
        ok(output.includes("  Members:"));
        // aligned on the longest member name
        ok(output.includes("    - metro                          0.84.5, 0.87.0"));
        ok(output.includes("    - metro-config-with-a-long-name  0.87.0"));
    });
    it("says when a member also has non-npm resolutions", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    memberVersions: {
                        metro: { versions: ["0.84.5"], nonNpmCount: 1 },
                        "metro-config": { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
                    },
                }),
            ],
        });
        ok(output.includes("0.84.5 (+1 non-npm)"));
    });
    it("renders the target, the drivers and the members that follow", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    members: ["metro", "metro-config", "metro-core"],
                    convergentMembers: ["metro", "metro-config", "metro-core"],
                    driverMembers: ["metro"],
                }),
            ],
        });
        ok(output.includes("  Dedupe: 0.87.0 (upgrade)"));
        ok(output.includes("    Driven by: metro (2 members follow)"));
    });
    it("uses the singular when one member follows", () => {
        ok(render({ clusterFixes: [clusterFix()] }).includes("(1 member follows)"));
    });
    it("names the members whose version the resolver picks", () => {
        const output = render({
            clusterFixes: [clusterFix({ floatingMembers: ["metro-config"] })],
        });
        ok(output.includes("    Resolver picks: metro-config"));
    });
    it("has no Dedupe section for an unfixable cluster", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    target: null,
                    direction: "none",
                    applicable: false,
                    convergentMembers: [],
                    driverMembers: [],
                    reResolutionSet: [],
                }),
            ],
        });
        ok(output.includes("[2 packages, 2 duplicated, 0 fixable]:"));
        ok(!output.includes("Dedupe:"));
        ok(lastLine(output).includes("0 dedupable"));
    });
    it("renders the duplicates an excluded member keeps", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    convergentMembers: ["metro"],
                    excludedMembers: [
                        {
                            packageName: "metro-config",
                            blockedBy: [
                                {
                                    requester: "react-native-web@0.21.2",
                                    requesterName: "react-native-web",
                                    packageName: "metro-config",
                                    range: "^0.74.1",
                                },
                            ],
                        },
                    ],
                }),
            ],
        });
        ok(output.includes("  Remaining duplicates:"));
        ok(output.includes('    - metro-config: react-native-web requires "^0.74.1"'));
    });
    it("renders open ranges that did not reuse the anchored version", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    anchor: "0.84.5",
                    reuseFixes: [
                        {
                            requester: "mini-deep@2.0.0",
                            requesterName: "mini-deep",
                            packageName: "metro-config",
                            range: "*",
                            from: "0.87.0",
                            to: "0.84.5",
                        },
                    ],
                }),
            ],
        });
        ok(output.includes("  Open ranges not reusing the pinned 0.84.5:"));
        ok(output.includes('    - mini-deep requires metro-config "*", resolved 0.87.0 -> would pin 0.84.5'));
    });
    it("renders open ranges even when the cluster cannot be fixed", () => {
        const output = render({
            clusterFixes: [
                clusterFix({
                    applicable: false,
                    target: null,
                    convergentMembers: [],
                    anchor: "0.84.5",
                    reuseFixes: [
                        {
                            requester: "mini-deep@2.0.0",
                            requesterName: "mini-deep",
                            packageName: "metro-config",
                            range: "*",
                            from: "0.87.0",
                            to: "0.84.5",
                        },
                    ],
                }),
            ],
        });
        ok(output.includes("Open ranges not reusing the pinned 0.84.5:"));
    });
    it("attributes a workspace constraint to the workspace", () => {
        const output = render({ clusterFixes: [clusterFix()] });
        ok(output.includes("  External constraints:"));
        ok(output.includes('    - workspace requires metro "0.84.5"'));
    });
    it("skips a cluster with no duplicated member", () => {
        const output = render({
            clusterFixes: [clusterFix({ duplicatedMembers: [] })],
        });
        ok(!output.includes("Lockstep clusters:"));
        ok(!output.includes("Cluster: 1"));
    });
    it("titles the report for a match listing", () => {
        ok(render({ title: "matches" }).startsWith("Found 1 match:\n"));
    });
    it("emits no escape codes with color off, and some with it on", () => {
        ok(!render({ clusterFixes: [clusterFix()] }).includes(escapeStart));
        ok(render({ color: true, clusterFixes: [clusterFix()] }).includes(escapeStart));
    });
});
//# sourceMappingURL=renderDuplicatesReport.test.js.map