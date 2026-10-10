import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture } from "./helpers/fixtures.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import type { ClusterFix } from "./identifyClusterFixes.ts";

const fixesFor = (fixture: string): ClusterFix[] => {
  const { packages, packagesMap, workspaces } = loadFixture(fixture);
  return identifyClusterFixes(packagesMap, packages, workspaces);
};

describe("identifyClusterFixes", () => {
  // the case the lockfile pass cannot reach: no member can be merged on its
  // own, and the family only converges once every member moves together
  describe("a lockstep family held apart by an exact pin", () => {
    const fix = (): ClusterFix => {
      const fixes = fixesFor("duplicated-typescript-eslint");
      strictEqual(fixes.length, 1);
      return fixes[0]!;
    };

    it("finds the whole @typescript-eslint family", () => {
      deepStrictEqual(fix().members, [
        "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser",
        "@typescript-eslint/type-utils",
        "@typescript-eslint/types",
        "@typescript-eslint/utils",
      ]);
      deepStrictEqual(fix().duplicatedMembers, [
        "@typescript-eslint/types",
        "@typescript-eslint/utils",
      ]);
    });

    it("converges it onto the pinned version, downwards", () => {
      strictEqual(fix().applicable, true);
      strictEqual(fix().target, "8.43.0");
      strictEqual(fix().direction, "down");
      deepStrictEqual(fix().convergentMembers, [
        "@typescript-eslint/types",
        "@typescript-eslint/utils",
      ]);
      deepStrictEqual(fix().excludedMembers, []);
    });

    // `@pob/eslint-plugin`'s exact `8.43.0` on utils is the only external range
    // that is not open: everything else in the family follows it
    it("names the exact pin as the driver", () => {
      deepStrictEqual(fix().driverMembers, ["@typescript-eslint/utils"]);
      deepStrictEqual(fix().reuseFixes, []);
    });

    // the members pulled in from outside carry no 8.43.0 copy, so reaching it
    // needs a real install
    it("asks for an install round trip for the externally-pulled members", () => {
      deepStrictEqual(fix().reResolutionSet, [
        "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser",
      ]);
      strictEqual(fix().needsRoundTrip, true);
    });

    it("keeps the real external ranges and drops derived internal pins", () => {
      const constraints = fix().externalConstraints.map(
        (constraint) =>
          `${constraint.requesterName ?? "workspace"} -> ${constraint.packageName} @ ${constraint.range}`,
      );

      ok(
        constraints.includes(
          "@pob/eslint-config -> @typescript-eslint/eslint-plugin @ ^8.43.0",
        ),
      );
      ok(
        constraints.includes(
          "@pob/eslint-plugin -> @typescript-eslint/utils @ 8.43.0",
        ),
      );

      const requesters = new Set(
        fix().externalConstraints.map((c) => c.requesterName),
      );
      strictEqual(requesters.has("@typescript-eslint/type-utils"), false);
    });
  });

  // the same scenario as bun-dedup's and pnpm-dedup's `wildcard-not-reused`
  // fixture, in yarn's lockfile shape
  it("repoints an open range that ignored the pinned version", () => {
    const fixes = fixesFor("wildcard-not-reused");
    strictEqual(fixes.length, 1);
    const fix = fixes[0]!;

    strictEqual(fix.target, "0.84.5");
    strictEqual(fix.direction, "down");
    strictEqual(fix.anchor, "0.84.5");
    deepStrictEqual(fix.convergentMembers, ["mini-metro", "mini-metro-config"]);
    deepStrictEqual(fix.driverMembers, ["mini-metro"]);
    deepStrictEqual(fix.workspaceChanges, []);
    deepStrictEqual(fix.reuseFixes, [
      {
        requester: "mini-plugin@npm:1.0.0",
        requesterName: "mini-plugin",
        packageName: "mini-metro-config",
        range: "*",
        from: "0.87.0",
        to: "0.84.5",
      },
    ]);
  });

  it("returns no cluster fix when there is no lockstep family", () => {
    deepStrictEqual(fixesFor("duplicated-printable-shell-command"), []);
  });

  // barcode-detector pins zxing-wasm at a version of its own, which is not a
  // co-version edge: they are not a family, and the lockfile pass handles them
  it("does not cluster a package that merely pins another", () => {
    deepStrictEqual(fixesFor("exact-pin-forces-downgrade"), []);
  });

  it("returns nothing for a lockfile with no duplicate", () => {
    deepStrictEqual(fixesFor("simple"), []);
  });
});
