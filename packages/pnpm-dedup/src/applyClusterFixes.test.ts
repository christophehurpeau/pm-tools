import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  ClusterFix,
  DuplicateSnapshot,
  VersionsSnapshot,
} from "pm-dedup-core";
import { applyClusterFixes } from "./applyClusterFixes.ts";
import type { DependentRangesMap } from "./helpers/collectDependentRanges.ts";
import { createTempProjects } from "./helpers/tempProjects.ts";

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

const workspaceYamlContent = "# keep me\nresolutionMode: time-based\n";

const projects = createTempProjects("pnpm-dedup-apply-");

const makeProject = (files: Record<string, string>): string => {
  const dir = projects.create();
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
};

afterEach(projects.cleanup);

const read = (dir: string, name: string): string =>
  readFileSync(join(dir, name), "utf8");

const snapshot = (...resolutions: string[]): DuplicateSnapshot =>
  new Set(resolutions);

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
        workspace: { path: ".", depType: "devDependencies" },
      },
    ],
  });

  it("keeps the workspace edit and never writes an override when it is enough", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": workspaceYamlContent,
    });

    let duplicates = snapshot("metro-config@0.84.5", "metro-config@0.87.0");
    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: () => undefined,
      pnpmVersion: () => "11.17.0",
      readFixes: () => [metroFix],
      readDuplicates: () => duplicates,
      resolve: () => {
        // pnpm's part: with the pin widened, the 0.84.5 subtree has no reason
        // to exist any more
        if (read(dir, "package.json").includes('"metro": "0.87.0"')) {
          duplicates = snapshot();
        }
        return 0;
      },
    });

    strictEqual(outcome.status, "applied");
    strictEqual(outcome.after.size, 0);
    ok(read(dir, "package.json").includes('"metro": "0.87.0"'));
    strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
  });

  const leafFix = fix({
    applicable: true,
    target: "2.0.0",
    convergentMembers: ["leaf"],
  });

  it("removes the overrides again once pnpm holds the result on its own", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": workspaceYamlContent,
    });

    let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");
    let converged = false;
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.13.0",
      readFixes: () => [leafFix],
      readDuplicates: () => duplicates,
      resolve: () => {
        if (read(dir, "pnpm-workspace.yaml").includes('"leaf@"')) {
          converged = true;
        }
        // sticky: pnpm keeps a locked resolution that still satisfies the range
        duplicates = converged ? snapshot() : duplicates;
        return 0;
      },
    });

    strictEqual(outcome.status, "applied");
    deepStrictEqual(outcome.stickyOverrides, []);
    strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
    ok(logs.some((line) => line.includes("Removing the overrides")));
  });

  describe("when some overrides do not hold", () => {
    const familyFix = (...convergentMembers: string[]): ClusterFix =>
      fix({ applicable: true, target: "2.0.0", convergentMembers });

    /**
     * pnpm as far as the override step can tell, its state kept in the lockfile
     * so that restoring files restores it too. A package with an override in
     * `pnpm-workspace.yaml` merges onto 2.0.0; without one, a merged package
     * stays merged only if `stays` says so, given what was merged before.
     */
    const simulatePnpm = (
      dir: string,
      packages: string[],
      stays: Record<string, (merged: Set<string>) => boolean>,
    ) => {
      const mergedNow = (): Set<string> =>
        new Set(
          /# merged: (.*)/
            .exec(read(dir, "pnpm-lock.yaml"))?.[1]
            ?.split(",")
            .filter(Boolean),
        );
      return {
        resolve: (): number => {
          const workspaceYaml = read(dir, "pnpm-workspace.yaml");
          const previous = mergedNow();
          const merged = packages.filter(
            (name) =>
              new RegExp(`"${name}@?":`).test(workspaceYaml) ||
              (previous.has(name) && (stays[name]?.(previous) ?? false)),
          );
          writeFileSync(
            join(dir, "pnpm-lock.yaml"),
            `lockfileVersion: '9.0'\n# merged: ${merged.join(",")}\n`,
          );
          return 0;
        },
        readDuplicates: (): DuplicateSnapshot => {
          const merged = mergedNow();
          return new Set(
            packages.flatMap((name) =>
              merged.has(name) ? [] : [`${name}@1.0.0`, `${name}@2.0.0`],
            ),
          );
        },
        readVersions: (): VersionsSnapshot => {
          const merged = mergedNow();
          return new Map(
            packages.map((name) => [
              name,
              merged.has(name) ? ["2.0.0"] : ["1.0.0", "2.0.0"],
            ]),
          );
        },
      };
    };

    const branchDependent = (name: string): DependentRangesMap =>
      new Map([
        [
          name,
          [
            {
              key: "branch@1.0.0",
              range: "^1.0.0",
              resolvedVersion: "1.0.0",
              requesterName: "branch",
            },
          ],
        ],
      ]);

    const sticky = (): boolean => true;
    const stickyWith =
      (companion: string) =>
      (merged: Set<string>): boolean =>
        merged.has(companion);

    const run = (
      dir: string,
      fixes: ClusterFix[],
      pnpm: ReturnType<typeof simulatePnpm>,
      logs: string[],
      dependentRanges: DependentRangesMap = new Map(),
    ) =>
      applyClusterFixes({
        projectDir: dir,
        color: false,
        log: (message = "") => logs.push(message),
        pnpmVersion: () => "11.17.0",
        readFixes: () => fixes,
        readDependentRanges: () => dependentRanges,
        ...pnpm,
      });

    const projectFiles = {
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": workspaceYamlContent,
    };

    const addedIn = (logs: string[], from: number): string[] =>
      logs.slice(from).filter((line) => /^ {2}"\w+@": "2\.0\.0"/.test(line));

    it("keeps only the overrides that hold, and leaves none behind", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const pnpm = simulatePnpm(dir, ["leaf", "twig"], { leaf: sticky });

      const outcome = run(
        dir,
        [familyFix("leaf", "twig")],
        pnpm,
        logs,
        branchDependent("twig"),
      );

      strictEqual(outcome.status, "applied");
      deepStrictEqual([...outcome.after], ["twig@1.0.0", "twig@2.0.0"]);
      deepStrictEqual(
        outcome.stickyOverrides.map((override) => override.packageName),
        ["twig"],
      );
      strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);

      const retry = logs.indexOf("Retrying with only the overrides that held:");
      ok(retry > 0);
      deepStrictEqual(addedIn(logs, retry), ['  "leaf@": "2.0.0" (converge)']);
      ok(
        logs.includes(
          "pnpm resolves these back without an override, so they are not merged:",
        ),
      );
      ok(logs.includes("  twig onto 2.0.0:"));
      ok(logs.includes('    branch@1.0.0 requires "^1.0.0"'));
    });

    it("reverts and says so when an override does not merge even while present", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const pnpm = simulatePnpm(dir, ["leaf"], {});
      // pnpm ignores the override: the declared range rejects the version
      const inert = { ...pnpm, resolve: () => 0 };

      const outcome = run(
        dir,
        [familyFix("leaf")],
        inert,
        logs,
        branchDependent("leaf"),
      );

      strictEqual(outcome.status, "reverted");
      deepStrictEqual(
        outcome.stickyOverrides.map((override) => override.packageName),
        ["leaf"],
      );
      strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
      ok(logs.includes("Not merged even with an override:"));
      ok(logs.includes("  No override holds on its own — reverting them"));
    });

    it("keeps the range edits when no override holds", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const pnpm = simulatePnpm(dir, ["metro-config"], {});

      const outcome = run(dir, [metroFix], pnpm, logs);

      strictEqual(outcome.status, "applied");
      ok(read(dir, "package.json").includes('"metro": "0.87.0"'));
      strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
    });

    it("drops an override that only held alongside one a round lost", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const pnpm = simulatePnpm(dir, ["leaf", "twig", "bud"], {
        leaf: sticky,
        twig: stickyWith("bud"),
      });

      const outcome = run(dir, [familyFix("leaf", "twig", "bud")], pnpm, logs);

      strictEqual(outcome.status, "applied");
      deepStrictEqual(
        outcome.stickyOverrides.map((override) => override.packageName),
        ["bud", "twig"],
      );
      deepStrictEqual(
        addedIn(
          logs,
          logs.lastIndexOf("Retrying with only the overrides that held:"),
        ),
        ['  "leaf@": "2.0.0" (converge)'],
      );
      strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
    });

    it("gives up after three rounds", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const pnpm = simulatePnpm(dir, ["leaf", "twig", "bud", "seed"], {
        leaf: sticky,
        twig: stickyWith("bud"),
        bud: stickyWith("seed"),
      });

      const outcome = run(
        dir,
        [familyFix("leaf", "twig", "bud", "seed")],
        pnpm,
        logs,
      );

      strictEqual(outcome.status, "reverted");
      strictEqual(outcome.stickyOverrides.length, 4);
      strictEqual(logs.filter((line) => line.startsWith("Retrying")).length, 2);
      ok(
        logs.includes(
          "  Overrides still came apart after 3 rounds — reverting them",
        ),
      );
      strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
      deepStrictEqual(outcome.after, outcome.before);
    });

    it("keeps the same rule with plain overrides", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const pnpm = simulatePnpm(dir, ["leaf", "twig"], { leaf: sticky });

      const outcome = applyClusterFixes({
        projectDir: dir,
        color: false,
        log: (message = "") => logs.push(message),
        convergenceOverrides: false,
        readFixes: () => [familyFix("leaf", "twig")],
        readDependentRanges: () => new Map(),
        ...pnpm,
      });

      strictEqual(outcome.status, "applied");
      deepStrictEqual(
        outcome.stickyOverrides.map((override) => override.packageName),
        ["twig"],
      );
      strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
    });

    it("judges a reuse override by its edge, not by the detector", () => {
      const dir = makeProject(projectFiles);
      const logs: string[] = [];
      const reuseFix = fix({
        anchor: "2.0.0",
        reuseFixes: [
          {
            requester: "plugin@1.0.0",
            requesterName: "plugin",
            packageName: "leaf",
            range: "*",
            from: "1.0.0",
            to: "2.0.0",
          },
        ],
      });
      let resolved = false;

      const outcome = applyClusterFixes({
        projectDir: dir,
        color: false,
        log: (message = "") => logs.push(message),
        pnpmVersion: () => "11.17.0",
        // the anchor goes away once pnpm runs, and the detector with it
        readFixes: () => (resolved ? [] : [reuseFix]),
        readDuplicates: () => snapshot("leaf@1.0.0", "leaf@2.0.0"),
        readDependentRanges: () =>
          new Map([
            [
              "leaf",
              [
                {
                  key: "plugin@1.0.0",
                  range: "*",
                  resolvedVersion: "1.0.0",
                  requesterName: "plugin",
                },
              ],
            ],
          ]),
        resolve: () => {
          resolved = true;
          return 0;
        },
      });

      strictEqual(outcome.status, "reverted");
      deepStrictEqual(
        outcome.stickyOverrides.map((override) => override.packageName),
        ["leaf"],
      );
      ok(logs.includes("  leaf onto 2.0.0 (reuse):"));
      ok(
        logs.includes(
          '    plugin@1.0.0 requires "*", resolves 1.0.0 without an override',
        ),
      );
    });
  });

  it("writes the override for a member nothing duplicates that holds its family apart", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": workspaceYamlContent,
    });
    const logs: string[] = [];
    let parentMoved = false;

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      readFixes: () => [
        fix({
          applicable: true,
          target: "2.0.0",
          convergentMembers: ["leaf"],
          reResolutionSet: ["parent"],
        }),
      ],
      readDuplicates: () =>
        parentMoved ? snapshot() : snapshot("leaf@1.0.0", "leaf@2.0.0"),
      readVersions: () =>
        new Map([
          ["leaf", parentMoved ? ["2.0.0"] : ["1.0.0", "2.0.0"]],
          ["parent", [parentMoved ? "2.0.0" : "1.0.0"]],
        ]),
      resolve: () => {
        // parent pins leaf exactly: the family only merges once parent moves
        if (read(dir, "pnpm-workspace.yaml").includes('"parent@"')) {
          parentMoved = true;
        }
        return 0;
      },
    });

    strictEqual(outcome.status, "applied");
    deepStrictEqual(outcome.stickyOverrides, []);
    ok(logs.includes('  "parent@": "2.0.0" (converge)'));
    strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
  });

  it("reverts when the result without overrides adds a duplicate", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": workspaceYamlContent,
    });
    const logs: string[] = [];
    let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      readFixes: () => [leafFix],
      readDuplicates: () => duplicates,
      resolve: () => {
        duplicates = read(dir, "pnpm-workspace.yaml").includes('"leaf@"')
          ? snapshot()
          : snapshot("leaf@1.0.0", "leaf@2.0.0", "other@1.0.0", "other@2.0.0");
        return 0;
      },
    });

    strictEqual(outcome.status, "reverted");
    ok(
      logs.includes(
        "  removing the overrides introduced 2 new duplicate(s) — reverting",
      ),
    );
    strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
  });

  it("writes plain overrides and skips the version gate when convergence is disabled", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      "pnpm-workspace.yaml": workspaceYamlContent,
    });

    let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");
    let plainKeyWritten = false;

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: () => undefined,
      convergenceOverrides: false,
      // a pnpm too old for convergence overrides still writes plain ones
      pnpmVersion: () => "11.12.0",
      readFixes: () => [leafFix],
      readDuplicates: () => duplicates,
      resolve: () => {
        if (read(dir, "pnpm-workspace.yaml").includes('"leaf": "2.0.0"')) {
          plainKeyWritten = true;
          duplicates = snapshot();
        }
        return 0;
      },
    });

    strictEqual(outcome.status, "applied");
    ok(plainKeyWritten);
    strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
  });

  // a plain override has no range condition, so one the detector proposed from
  // a single requester's range cannot be written when another rejects it
  it("drops a plain override a third-party range rejects", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      convergenceOverrides: false,
      pnpmVersion: () => "11.17.0",
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
      resolve: () => {
        throw new Error("a dropped override must not resolve");
      },
    });

    strictEqual(outcome.status, "nothing-to-do");
    ok(logs.some((line) => line.includes("Skipped override")));
  });

  it("reverts everything when the re-resolution fails", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: () => undefined,
      pnpmVersion: () => "11.17.0",
      readFixes: () => [metroFix],
      readDuplicates: () =>
        snapshot("metro-config@0.84.5", "metro-config@0.87.0"),
      resolve: () => 1,
    });

    strictEqual(outcome.status, "reverted");
    strictEqual(read(dir, "package.json"), manifestContent);
    strictEqual(existsSync(join(dir, "pnpm-workspace.yaml")), false);
  });

  const metroFamilyFix = fix({
    ...metroFix,
    members: ["metro", "metro-config"],
    duplicatedMembers: ["metro-config"],
  });

  it("skips a cluster the filter only selects part of", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      filter: { include: ["metro-config"] },
      readFixes: () => [metroFamilyFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    strictEqual(outcome.plannedChangeCount, 0);
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes("metro not selected by the filter")));
  });

  it("keeps a cluster the filter selects whole", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: () => undefined,
      pnpmVersion: () => "11.17.0",
      filter: { include: ["metro*"] },
      readFixes: () => [metroFamilyFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    ok(outcome.plannedChangeCount > 0);
  });

  it("writes nothing on a dry run", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      readFixes: () => [metroFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
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

  describe("an open range that ignored the pinned version", () => {
    const reuseFix = (
      requesterName: string,
      packageName: string,
      range: string,
      from: string,
      to: string,
    ): ClusterFix =>
      fix({
        anchor: to,
        reuseFixes: [
          {
            requester: `${requesterName}@1.0.0`,
            requesterName,
            packageName,
            range,
            from,
            to,
          },
        ],
      });
    // the metro fixture's wildcard, and alouette's peer
    const reuseFixes = [
      reuseFix(
        "@tamagui/metro-plugin",
        "metro-config",
        "*",
        "0.87.0",
        "0.84.5",
      ),
      reuseFix(
        "react-native-css",
        "lightningcss",
        ">=1.27.0",
        "1.33.0",
        "1.30.1",
      ),
    ];

    it("plans a reuse override for each", () => {
      const dir = makeProject({
        "package.json": manifestContent,
        "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      });
      const logs: string[] = [];

      const outcome = applyClusterFixes({
        projectDir: dir,
        color: false,
        dryRun: true,
        log: (message = "") => logs.push(message),
        pnpmVersion: () => "11.17.0",
        readFixes: () => reuseFixes,
        readDuplicates: () => snapshot(),
        resolve: () => {
          throw new Error("a dry run must not resolve");
        },
      });

      strictEqual(outcome.plannedChangeCount, 2);
      ok(
        logs.some((line) => line.includes('"metro-config@": "0.84.5" (reuse)')),
      );
      ok(
        logs.some((line) => line.includes('"lightningcss@": "1.30.1" (reuse)')),
      );
    });
  });

  it("renders repo-relative paths and the transient override file", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      readFixes: () => [metroFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    const output = logs.join("\n");
    ok(output.includes("package.json:"));
    // never the absolute temp path
    ok(!output.includes(dir));
    ok(
      output.includes(
        "pnpm-workspace.yaml (transient, removed once the result is verified):",
      ),
    );
    ok(output.includes("Run `pnpm-dedupe` to apply."));
  });

  it("names what `pnpm dedupe` itself would still change", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      packageManagerResiduals: "`pnpm dedupe` would also change the lockfile.",
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      readFixes: () => [metroFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    ok(logs.includes("`pnpm dedupe` would also change the lockfile."));
  });

  it("reports nothing to dedupe on a dry run with an empty plan", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      readFixes: () => [],
      readDuplicates: () => snapshot(),
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    strictEqual(outcome.status, "dry-run");
    strictEqual(outcome.plannedChangeCount, 0);
    ok(logs.includes("Nothing to dedupe."));
  });

  it("plans nothing on a dry run when pnpm cannot apply it", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      dryRun: true,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "9.0.0",
      readFixes: () => [metroFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    // nothing is applicable, so `--check` has nothing to fail on
    strictEqual(outcome.plannedChangeCount, 0);
    ok(logs.some((line) => line.includes("Cluster fixes need pnpm >=")));
    ok(logs.includes("Nothing to dedupe."));
  });

  it("does nothing on a pnpm without convergence overrides", () => {
    const dir = makeProject({
      "package.json": manifestContent,
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    });
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: dir,
      color: false,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.12.0",
      readFixes: () => [metroFix],
      readDuplicates: () => snapshot("metro-config@0.84.5"),
      resolve: () => {
        throw new Error("an unsupported pnpm must not resolve");
      },
    });

    strictEqual(outcome.status, "not-supported");
    strictEqual(read(dir, "package.json"), manifestContent);
    ok(logs.some((line) => line.includes("11.13.0")));
  });

  // End to end from the committed fixture: the detector, the plan and the file
  // the override would land in, with nothing stubbed but the pnpm version.
  it("plans a convergence override for a lone duplicate", () => {
    const logs: string[] = [];

    const outcome = applyClusterFixes({
      projectDir: fileURLToPath(
        new URL("../test/fixtures/exact-pin-forces-downgrade", import.meta.url),
      ),
      dryRun: true,
      log: (message = "") => logs.push(message),
      pnpmVersion: () => "11.17.0",
      resolve: () => {
        throw new Error("a dry run must not resolve");
      },
    });

    strictEqual(outcome.status, "dry-run");
    strictEqual(outcome.plannedChangeCount, 1);
    ok(logs.some((line) => line.includes("pnpm-workspace.yaml")));
    ok(
      logs.some((line) =>
        line.includes('"barcode-detector@": "3.0.3" (converge)'),
      ),
    );
    // zxing-wasm has no covering version, so nothing is planned for it
    ok(!logs.some((line) => line.includes("zxing-wasm")));
  });

  it("reports having nothing to do when no fix is applicable", () => {
    const dir = makeProject({ "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" });

    strictEqual(
      applyClusterFixes({
        projectDir: dir,
        color: false,
        log: () => undefined,
        pnpmVersion: () => "11.17.0",
        readFixes: () => [fix({ applicable: false })],
        readDuplicates: () => snapshot("leaf@1.0.0"),
        resolve: () => {
          throw new Error("nothing to apply must not resolve");
        },
      }).status,
      "nothing-to-do",
    );
  });
});
