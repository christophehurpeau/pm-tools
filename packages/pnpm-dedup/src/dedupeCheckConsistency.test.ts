import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
  parsePnpmLockPackages,
  readPnpmLock,
} from "./index.ts";

// These tests shell out to the real `pnpm` and require either network access or
// a warm pnpm store; they are skipped when pnpm is not on PATH. `--lockfile-only`
// keeps pnpm from writing node_modules, and `--frozen-lockfile` / `--check` never
// rewrite the lockfile, so pnpm runs against the committed fixtures in place
// without modifying them (asserted below). `pnpm dedupe --check` only flags the
// safely-mergeable subset of duplicates, so the invariant is: everything pnpm
// would dedupe is also reported by our listing.

const pnpmAvailable =
  spawnSync("pnpm", ["--version"], { encoding: "utf8" }).status === 0;

const fixturePath = (scenario: string): string =>
  fileURLToPath(new URL(`../test/fixtures/${scenario}`, import.meta.url));

interface PnpmRun {
  status: number | null;
  output: string;
}

const runPnpm = (cwd: string, args: string[]): PnpmRun => {
  const result = spawnSync(
    "pnpm",
    [...args, "--lockfile-only", "--prefer-offline", "--ignore-scripts"],
    { cwd, encoding: "utf8", timeout: 120_000 },
  );
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
};

// `pnpm dedupe --check` prints a tree of changes; each merged dependency is on a
// branch line `├── name fromVersion → toVersion`. We collect those names.
const parseDedupedPackages = (output: string): string[] => {
  const names = new Set<string>();
  for (const line of output.split("\n")) {
    if (!line.includes("→")) continue;
    const name = line
      .replace(/^[\s│├└─]+/u, "")
      .trim()
      .split(/\s+/u)[0];
    if (name) {
      names.add(name);
    }
  }
  return [...names].toSorted();
};

const duplicateNames = (scenario: string): string[] => {
  const lock = readPnpmLock(join(fixturePath(scenario), "pnpm-lock.yaml"));
  const duplicates = filterDuplicatesPnpmPackagesMap(
    buildPnpmPackagesMap(parsePnpmLockPackages(lock)),
  );
  return Object.keys(duplicates).toSorted();
};

const lockContent = (dir: string): string =>
  readFileSync(join(dir, "pnpm-lock.yaml"), "utf8");

// Defensive: `--lockfile-only` should never create node_modules, but if a future
// pnpm version does, do not leave it in the committed fixture directory.
const assertPristine = (dir: string, lockBefore: string): void => {
  strictEqual(
    lockContent(dir),
    lockBefore,
    "pnpm must not change the lockfile",
  );
  rmSync(join(dir, "node_modules"), { recursive: true, force: true });
};

const suite = pnpmAvailable ? describe : describe.skip;

suite("pnpm dedupe --check vs listDuplicates", () => {
  it("flags the mergeable subset, all of which listDuplicates reports", () => {
    const dir = fixturePath("duplicated-typescript-eslint");
    const lockBefore = lockContent(dir);

    const install = runPnpm(dir, ["install", "--frozen-lockfile"]);
    strictEqual(install.status, 0, install.output);
    assertPristine(dir, lockBefore);

    const check = runPnpm(dir, ["dedupe", "--check"]);
    ok(
      check.status !== 0,
      `dedupe --check should flag issues\n${check.output}`,
    );
    assertPristine(dir, lockBefore);

    const flagged = parseDedupedPackages(check.output);
    deepStrictEqual(flagged, [
      "@typescript-eslint/tsconfig-utils",
      "@typescript-eslint/types",
    ]);

    const duplicates = duplicateNames("duplicated-typescript-eslint");
    for (const name of flagged) {
      ok(
        duplicates.includes(name),
        `listDuplicates should report ${name} that pnpm dedupe flags`,
      );
    }
  }, 180_000);

  // Duplicates pnpm cannot safely merge: `dedupe --check` exits 0 and flags
  // nothing, yet listDuplicates still reports the duplicate.
  const unmergeable: { scenario: string; expectedDuplicate: string }[] = [
    {
      scenario: "duplicated-babel-frame",
      expectedDuplicate: "@babel/code-frame",
    },
    {
      scenario: "duplicated-printable-shell-command",
      expectedDuplicate: "printable-shell-command",
    },
  ];

  for (const { scenario, expectedDuplicate } of unmergeable) {
    it(`flags nothing for ${scenario} but still lists ${expectedDuplicate}`, () => {
      const dir = fixturePath(scenario);
      const lockBefore = lockContent(dir);

      const install = runPnpm(dir, ["install", "--frozen-lockfile"]);
      strictEqual(install.status, 0, install.output);
      assertPristine(dir, lockBefore);

      const check = runPnpm(dir, ["dedupe", "--check"]);
      strictEqual(
        check.status,
        0,
        `dedupe --check should find nothing to merge\n${check.output}`,
      );
      assertPristine(dir, lockBefore);

      deepStrictEqual(parseDedupedPackages(check.output), []);
      ok(duplicateNames(scenario).includes(expectedDuplicate));
    }, 180_000);
  }
});
