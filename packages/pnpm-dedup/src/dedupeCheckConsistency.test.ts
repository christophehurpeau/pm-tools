import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildIdentifiedFixesMap } from "pm-dedup-core";
import {
  buildPnpmPackagesMap,
  collectPnpmDependents,
  filterDuplicatesPnpmPackagesMap,
  parsePnpmLockPackages,
  readPnpmLock,
} from "./index.ts";

// These tests shell out to the real `pnpm` and require either network access or
// a warm pnpm store. `--lockfile-only` keeps pnpm from writing node_modules, and
// `--frozen-lockfile` / `--check` never rewrite the lockfile, so pnpm runs
// against the committed fixtures in place without modifying them (asserted
// below). The invariant is: everything `pnpm dedupe` would merge is also
// reported by our listing.
//
// What `dedupe` merges changes between pnpm minors, so the expectations hold for
// pnpm 12 only and the suite is skipped under any other major. The fixtures cannot
// pin it through `packageManager`: pnpm 12 records the pinned version in the
// lockfile, which breaks their byte-exactness.

const SUPPORTED_PNPM_MAJOR = 12;

const pnpmMajor = ((): number | null => {
  const result = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return Number(result.stdout.trim().split(".")[0]);
})();

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

const withoutPeerSuffix = (version: string): string =>
  version.split("(")[0] ?? "";

// `pnpm dedupe --check` prints a tree of changes, one `├── name from → to` branch
// per changed dependency. A change that keeps the version only re-resolves peers,
// which is not a merge.
const parseMergedPackages = (output: string): string[] => {
  const names = new Set<string>();
  for (const line of output.split("\n")) {
    if (!line.includes("→")) continue;
    const [name, from, , to] = line
      .replace(/^[\s│├└─]+/u, "")
      .trim()
      .split(/\s+/u);
    if (
      name &&
      from &&
      to &&
      withoutPeerSuffix(from) !== withoutPeerSuffix(to)
    ) {
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

const fixTargets = (scenario: string, packageName: string): string[] => {
  const lock = readPnpmLock(join(fixturePath(scenario), "pnpm-lock.yaml"));
  const duplicates = filterDuplicatesPnpmPackagesMap(
    buildPnpmPackagesMap(parsePnpmLockPackages(lock)),
  );
  const fixes = buildIdentifiedFixesMap(
    duplicates,
    collectPnpmDependents(lock, Object.keys(duplicates)),
  );
  return (fixes.get(packageName) ?? []).map((fix) => fix.to);
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

const suite = pnpmMajor === SUPPORTED_PNPM_MAJOR ? describe : describe.skip;

suite("pnpm dedupe --check vs listDuplicates", () => {
  // pnpm merges none of these duplicates, yet listDuplicates reports each one.
  // In the `duplicated-typescript-eslint*` fixtures (`-dedupe-peers` is the same
  // dependency with `dedupePeers: true`, which flattens the peer suffixes) pnpm
  // re-resolves `@pob/eslint-config`'s auto-installed `eslint` peer to 9.39.5,
  // the newest version that also satisfies eslint-plugin-react, and leaves the
  // @typescript-eslint packages duplicated; pnpm 11.26 still merged them.
  // The `mergeable-alias*` fixtures go one step further: every declared range
  // accepts the aliased 5.0.7 pin, so we do identify a merge target — one pnpm
  // will never apply, because merging means downgrading the range from 5.3.1.
  // `wildcard-not-reused` is the widest case: a `*` range resolved to 0.87.0
  // instead of the installed 0.84.5, duplicating the metro family (see
  // wildcardNotReused.test.ts). pnpm will not undo it either; it only re-resolves
  // the optional `supports-color` peer of metro-symbolicate.
  const scenarios: {
    scenario: string;
    expectedDuplicate: string;
    expectedFixTargets?: string[];
  }[] = [
    {
      scenario: "duplicated-typescript-eslint",
      expectedDuplicate: "@typescript-eslint/types",
    },
    {
      scenario: "duplicated-typescript-eslint-dedupe-peers",
      expectedDuplicate: "@typescript-eslint/types",
    },
    {
      scenario: "duplicated-babel-frame",
      expectedDuplicate: "@babel/code-frame",
    },
    {
      scenario: "duplicated-printable-shell-command",
      expectedDuplicate: "printable-shell-command",
    },
    {
      scenario: "mergeable-alias",
      expectedDuplicate: "printable-shell-command",
      expectedFixTargets: ["printable-shell-command@5.0.7"],
    },
    {
      scenario: "mergeable-alias-dedupe-peers",
      expectedDuplicate: "printable-shell-command",
      expectedFixTargets: ["printable-shell-command@5.0.7"],
    },
    {
      scenario: "wildcard-not-reused",
      expectedDuplicate: "metro-config",
    },
  ];

  for (const { scenario, expectedDuplicate, expectedFixTargets } of scenarios) {
    it(
      `merges nothing in ${scenario} but still lists ${expectedDuplicate}`,
      { timeout: 180_000 },
      () => {
        const dir = fixturePath(scenario);
        const lockBefore = lockContent(dir);

        const install = runPnpm(dir, ["install", "--frozen-lockfile"]);
        strictEqual(install.status, 0, install.output);
        assertPristine(dir, lockBefore);

        // exits 1 on a peer-only re-resolution too
        const check = runPnpm(dir, ["dedupe", "--check"]);
        ok(
          check.status === 0 ||
            check.output.includes("ERR_PNPM_DEDUPE_CHECK_ISSUES"),
          check.output,
        );
        assertPristine(dir, lockBefore);

        deepStrictEqual(parseMergedPackages(check.output), []);
        ok(duplicateNames(scenario).includes(expectedDuplicate));
        deepStrictEqual(
          fixTargets(scenario, expectedDuplicate),
          expectedFixTargets ?? [],
        );
      },
    );
  }
});
