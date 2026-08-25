import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.js";
import { buildPnpmPackagesMap, collectPnpmDependents, filterDuplicatesPnpmPackagesMap, parsePnpmLockPackages, readPnpmLock, } from "./index.js";
// These tests shell out to the real `pnpm` and require either network access or
// a warm pnpm store; they are skipped when pnpm is not on PATH. `--lockfile-only`
// keeps pnpm from writing node_modules, and `--frozen-lockfile` / `--check` never
// rewrite the lockfile, so pnpm runs against the committed fixtures in place
// without modifying them (asserted below). `pnpm dedupe --check` only flags the
// safely-mergeable subset of duplicates, so the invariant is: everything pnpm
// would dedupe is also reported by our listing.
const pnpmAvailable = spawnSync("pnpm", ["--version"], { encoding: "utf8" }).status === 0;
const fixturePath = (scenario) => fileURLToPath(new URL(`../test/fixtures/${scenario}`, import.meta.url));
const runPnpm = (cwd, args) => {
    const result = spawnSync("pnpm", [...args, "--lockfile-only", "--prefer-offline", "--ignore-scripts"], { cwd, encoding: "utf8", timeout: 120_000 });
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
const parseDedupedPackages = (output) => {
    const names = new Set();
    for (const line of output.split("\n")) {
        if (!line.includes("→"))
            continue;
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
const duplicateNames = (scenario) => {
    const lock = readPnpmLock(join(fixturePath(scenario), "pnpm-lock.yaml"));
    const duplicates = filterDuplicatesPnpmPackagesMap(buildPnpmPackagesMap(parsePnpmLockPackages(lock)));
    return Object.keys(duplicates).toSorted();
};
const fixTargets = (scenario, packageName) => {
    const lock = readPnpmLock(join(fixturePath(scenario), "pnpm-lock.yaml"));
    const duplicates = filterDuplicatesPnpmPackagesMap(buildPnpmPackagesMap(parsePnpmLockPackages(lock)));
    const fixes = buildIdentifiedFixesMap(duplicates, collectPnpmDependents(lock, Object.keys(duplicates)));
    return (fixes.get(packageName) ?? []).map((fix) => fix.to);
};
const lockContent = (dir) => readFileSync(join(dir, "pnpm-lock.yaml"), "utf8");
// Defensive: `--lockfile-only` should never create node_modules, but if a future
// pnpm version does, do not leave it in the committed fixture directory.
const assertPristine = (dir, lockBefore) => {
    strictEqual(lockContent(dir), lockBefore, "pnpm must not change the lockfile");
    rmSync(join(dir, "node_modules"), { recursive: true, force: true });
};
const suite = pnpmAvailable ? describe : describe.skip;
suite("pnpm dedupe --check vs listDuplicates", () => {
    // `duplicated-typescript-eslint-dedupe-peers` is the same dependency with
    // `dedupePeers: true`, which flattens the peer suffixes in the lockfile: pnpm
    // must still merge the same packages, and we must still list them.
    const mergeable = [
        {
            scenario: "duplicated-typescript-eslint",
            expectedFlagged: [
                "@typescript-eslint/tsconfig-utils",
                "@typescript-eslint/types",
            ],
        },
        {
            scenario: "duplicated-typescript-eslint-dedupe-peers",
            expectedFlagged: [
                "@typescript-eslint/tsconfig-utils",
                "@typescript-eslint/types",
            ],
        },
    ];
    for (const { scenario, expectedFlagged } of mergeable) {
        it(`flags the mergeable subset of ${scenario}, all of which listDuplicates reports`, () => {
            const dir = fixturePath(scenario);
            const lockBefore = lockContent(dir);
            const install = runPnpm(dir, ["install", "--frozen-lockfile"]);
            strictEqual(install.status, 0, install.output);
            assertPristine(dir, lockBefore);
            const check = runPnpm(dir, ["dedupe", "--check"]);
            ok(check.status !== 0, `dedupe --check should flag issues\n${check.output}`);
            assertPristine(dir, lockBefore);
            deepStrictEqual(parseDedupedPackages(check.output), expectedFlagged);
            const duplicates = duplicateNames(scenario);
            for (const name of expectedFlagged) {
                ok(duplicates.includes(name), `listDuplicates should report ${name} that pnpm dedupe flags`);
            }
        }, 180_000);
    }
    // Duplicates pnpm does not merge: `dedupe --check` exits 0 and flags nothing,
    // yet listDuplicates still reports the duplicate. The `mergeable-alias*`
    // fixtures go one step further: every declared range accepts the aliased
    // 5.0.7 pin, so we do identify a merge target — one pnpm will never apply,
    // because merging means downgrading the range from 5.3.1.
    // `wildcard-not-reused` is the widest case: a `*` range resolved to 0.87.0
    // instead of the installed 0.84.5, duplicating the metro family (see
    // wildcardNotReused.test.ts). pnpm will not undo it either.
    const unmergeableByPnpm = [
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
    for (const { scenario, expectedDuplicate, expectedFixTargets, } of unmergeableByPnpm) {
        it(`flags nothing for ${scenario} but still lists ${expectedDuplicate}`, () => {
            const dir = fixturePath(scenario);
            const lockBefore = lockContent(dir);
            const install = runPnpm(dir, ["install", "--frozen-lockfile"]);
            strictEqual(install.status, 0, install.output);
            assertPristine(dir, lockBefore);
            const check = runPnpm(dir, ["dedupe", "--check"]);
            strictEqual(check.status, 0, `dedupe --check should find nothing to merge\n${check.output}`);
            assertPristine(dir, lockBefore);
            deepStrictEqual(parseDedupedPackages(check.output), []);
            ok(duplicateNames(scenario).includes(expectedDuplicate));
            deepStrictEqual(fixTargets(scenario, expectedDuplicate), expectedFixTargets ?? []);
        }, 180_000);
    }
});
//# sourceMappingURL=dedupeCheckConsistency.test.js.map