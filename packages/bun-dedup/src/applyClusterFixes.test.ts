import { afterEach, describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClusterFix, DuplicateSnapshot } from "pm-utils";
import { applyClusterFixes } from "./applyClusterFixes.ts";

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

const manifestContent = [
  "{",
  '  "name": "root",',
  '  "devDependencies": {',
  '    "metro": "0.84.5"',
  "  }",
  "}",
  "",
].join("\n");

const projects: string[] = [];

const makeProject = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), "bun-dedup-apply-"));
  projects.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
};

afterEach(() => {
  for (const dir of projects.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const read = (dir: string, name: string): string =>
  readFileSync(join(dir, name), "utf8");

const snapshot = (...resolutions: string[]): DuplicateSnapshot =>
  new Set(resolutions);

const emptyLock = '{ "lockfileVersion": 1, "workspaces": {}, "packages": {} }';

describe("applyClusterFixes", () => {
  const metroFix = fix({
    applicable: true,
    target: "0.87.0",
    convergentMembers: ["metro-config"],
    workspaceChanges: [
      {
        requester: "package.json in devDependencies",
        requesterName: undefined,
        packageName: "metro",
        range: "0.84.5",
        to: "0.87.0",
        workspace: { path: "", depType: "devDependencies" },
      },
    ],
  });

  it("keeps the workspace edit and never writes an override when it is enough", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });

    let duplicates = snapshot("metro-config@0.84.5", "metro-config@0.87.0");
    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: () => undefined,
      readFixes: () => [metroFix],
      readDuplicates: () => duplicates,
      verifyFrozen: () => 0,
      resolve: () => {
        // bun's part: with the pin widened, the 0.84.5 subtree has no reason to
        // exist any more
        if (read(dir, "package.json").includes('"metro": "0.87.0"')) {
          duplicates = snapshot();
        }
        return 0;
      },
    });

    strictEqual(outcome.status, "applied");
    strictEqual(outcome.after.size, 0);
    ok(read(dir, "package.json").includes('"metro": "0.87.0"'));
    ok(!read(dir, "package.json").includes("overrides"));
  });

  const leafFix = fix({
    applicable: true,
    target: "2.0.0",
    convergentMembers: ["leaf"],
  });

  it("removes the overrides again once bun holds the result on its own", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });

    let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");
    let converged = false;
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      readFixes: () => [leafFix],
      readDuplicates: () => duplicates,
      verifyFrozen: () => 0,
      resolve: () => {
        if (read(dir, "package.json").includes('"leaf": "2.0.0"')) {
          converged = true;
        }
        // sticky: bun keeps a locked resolution that still satisfies the range
        duplicates = converged ? snapshot() : duplicates;
        return 0;
      },
    });

    strictEqual(outcome.status, "applied");
    deepStrictEqual(outcome.stickyOverrides, []);
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes("Removing the overrides")));
  });

  it("reverts and points at the issue tracker when the fix needs a standing override", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });

    const duplicated = snapshot("leaf@1.0.0", "leaf@2.0.0");
    let duplicates = duplicated;
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      readFixes: () => [leafFix],
      readDuplicates: () => duplicates,
      verifyFrozen: () => 0,
      resolve: () => {
        // the duplicate only stays away while the override is there
        duplicates = read(dir, "package.json").includes('"leaf": "2.0.0"')
          ? snapshot()
          : duplicated;
        return 0;
      },
    });

    strictEqual(outcome.status, "reverted");
    deepStrictEqual(
      outcome.stickyOverrides.map((override) => override.packageName),
      ["leaf"],
    );
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes("github.com/christophehurpeau")));
  });

  it("reverts when the result is not one `--frozen-lockfile` accepts", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });

    let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      readFixes: () => [leafFix],
      readDuplicates: () => duplicates,
      verifyFrozen: () => 1,
      resolve: () => {
        duplicates = snapshot();
        return 0;
      },
    });

    strictEqual(outcome.status, "reverted");
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes("--frozen-lockfile")));
  });

  it("reverts everything when the re-resolution fails", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: () => undefined,
      readFixes: () => [metroFix],
      readDuplicates: () =>
        snapshot("metro-config@0.84.5", "metro-config@0.87.0"),
      verifyFrozen: () => 0,
      resolve: () => 1,
    });

    strictEqual(outcome.status, "reverted");
    strictEqual(read(dir, "package.json"), manifestContent);
  });

  // bun overrides are unconditional, so one the detector proposed from a single
  // requester's range cannot be written when another requester rejects it
  it("drops an override a third-party range rejects", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      readFixes: () => [
        fix({
          anchor: "0.84.5",
          reuseFixes: [
            {
              requester: "@tamagui/metro-plugin@1.0.0",
              requesterName: "@tamagui/metro-plugin",
              packageName: "metro-config",
              range: "*",
              from: "0.87.0",
              to: "0.84.5",
            },
          ],
          externalConstraints: [
            {
              requester: "@react-native/community-cli-plugin@0.87.0",
              requesterName: "@react-native/community-cli-plugin",
              packageName: "metro-config",
              range: "^0.87.0",
            },
          ],
        }),
      ],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      verifyFrozen: () => 0,
      resolve: () => {
        throw new Error("a dropped override must not resolve");
      },
    });

    strictEqual(outcome.status, "nothing-to-do");
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes("Skipped override")));
  });

  it("writes nothing on a dry run", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: (message = "") => logs.push(message),
      readFixes: () => [metroFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      verifyFrozen: () => {
        throw new Error("a dry run must not verify");
      },
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    strictEqual(outcome.status, "dry-run");
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes('"0.84.5" -> "0.87.0"')));
    ok(logs.some((line) => line.startsWith("Would apply:")));
    ok(outcome.plannedChangeCount > 0);
  });

  it("reports having nothing to do when no fix is applicable", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "bun.lock": emptyLock,
    });

    strictEqual(
      applyClusterFixes({
        projectDir: dir,
        color: false,
        log: () => undefined,
        readFixes: () => [fix({ applicable: false })],
        readDuplicates: () => snapshot("leaf@1.0.0"),
        verifyFrozen: () => 0,
        resolve: () => {
          throw new Error("nothing to apply must not resolve");
        },
      }).status,
      "nothing-to-do",
    );
  });
});
