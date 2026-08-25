import { describe, it } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
import { planClusterApply } from "./planClusterApply.ts";

const fix = (overrides: Partial<ClusterFix>): ClusterFix => ({
  members: [],
  duplicatedMembers: [],
  memberVersions: {},
  target: null,
  direction: "none",
  convergentMembers: [],
  driverMembers: [],
  excludedMembers: [],
  anchor: null,
  reuseFixes: [],
  floatingMembers: [],
  workspaceChanges: [],
  reResolutionSet: [],
  externalConstraints: [],
  needsRoundTrip: false,
  applicable: false,
  ...overrides,
});

describe("planClusterApply", () => {
  it("edits the importer the workspace change points at", () => {
    const plan = planClusterApply([
      fix({
        applicable: true,
        target: "0.87.0",
        workspaceChanges: [
          {
            requester: "package.json in devDependencies",
            requesterName: undefined,
            packageName: "metro",
            range: "0.84.5",
            to: "0.87.0",
            workspace: { path: ".", depType: "devDependencies" },
          },
        ],
      }),
    ]);

    deepStrictEqual(plan.manifestEdits, [
      {
        importerPath: ".",
        depType: "devDependencies",
        packageName: "metro",
        range: "0.84.5",
        to: "0.87.0",
      },
    ]);
    deepStrictEqual(plan.unresolvableChanges, []);
  });

  it("reports a workspace change it cannot locate on disk", () => {
    const plan = planClusterApply([
      fix({
        applicable: true,
        target: "0.87.0",
        workspaceChanges: [
          {
            requester: "package.json in devDependencies",
            requesterName: undefined,
            packageName: "metro",
            range: "0.84.5",
            to: "0.87.0",
          },
        ],
      }),
    ]);

    deepStrictEqual(plan.manifestEdits, []);
    deepStrictEqual(plan.unresolvableChanges, [
      "metro in package.json in devDependencies",
    ]);
  });

  it("overrides the convergent members and the ones to re-resolve", () => {
    const plan = planClusterApply([
      fix({
        applicable: true,
        target: "8.59.1",
        convergentMembers: ["@typescript-eslint/types"],
        reResolutionSet: ["@typescript-eslint/parser"],
        // spared by construction: a convergence override skips the edges whose
        // declared range rejects the target
        excludedMembers: [
          { packageName: "@typescript-eslint/utils", blockedBy: [] },
        ],
      }),
    ]);

    deepStrictEqual(plan.overrides, [
      {
        packageName: "@typescript-eslint/parser",
        version: "8.59.1",
        reason: "converge",
      },
      {
        packageName: "@typescript-eslint/types",
        version: "8.59.1",
        reason: "converge",
      },
    ]);
  });

  it("lets the anchored reuse win over a computed target", () => {
    const plan = planClusterApply([
      fix({
        applicable: true,
        target: "0.87.0",
        convergentMembers: ["mini-metro-config"],
        anchor: "0.84.5",
        reuseFixes: [
          {
            requester: "mini-plugin@1.0.0",
            requesterName: "mini-plugin",
            packageName: "mini-metro-config",
            range: "*",
            from: "0.87.0",
            to: "0.84.5",
          },
        ],
      }),
    ]);

    deepStrictEqual(plan.overrides, [
      {
        packageName: "mini-metro-config",
        version: "0.84.5",
        reason: "reuse",
      },
    ]);
    deepStrictEqual(plan.conflicts, [
      { packageName: "mini-metro-config", kept: "0.84.5", dropped: "0.87.0" },
    ]);
  });

  it("ignores a cluster with no applicable fix but keeps its reuse fixes", () => {
    const plan = planClusterApply([
      fix({
        applicable: false,
        convergentMembers: ["ignored"],
        reuseFixes: [
          {
            requester: "plugin@1",
            requesterName: "plugin",
            packageName: "leaf",
            range: "*",
            from: "2.0.0",
            to: "1.0.0",
          },
        ],
      }),
    ]);

    deepStrictEqual(plan.overrides, [
      { packageName: "leaf", version: "1.0.0", reason: "reuse" },
    ]);
  });
});
