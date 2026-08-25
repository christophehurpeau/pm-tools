import { afterEach, describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPnpmPackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import { readDuplicateSnapshot } from "./helpers/duplicateSnapshot.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
import { readPnpmLock } from "./readPnpmLock.ts";

// The shipped tool against a real pnpm: a copy of the
// `exact-pin-forces-downgrade` fixture, a real `pnpm install`, then the built
// `pnpm-dedupe` bin as a user would run it. Every other test stubs the
// resolution step, so this is the only one that can tell whether pnpm holds the
// deduplicated result on its own once the transient override is removed again —
// the step the tool takes before reporting "applied" — and pnpm is asked for its
// own account of the tree at the end rather than only our reading of it.
//
// Requires network access or a warm pnpm store; skipped when pnpm is not on PATH.

const pnpmAvailable =
  spawnSync("pnpm", ["--version"], { encoding: "utf8" }).status === 0;

const fixtureDir = fileURLToPath(
  new URL("../test/fixtures/exact-pin-forces-downgrade", import.meta.url),
);
// the built bin, the one the `bin` field points at: from `src` it is one level
// up, and the compiled copy of this file sits beside it
const dedupeBin = ((): string => {
  const built = ["../dist/bin/pnpm-dedupe.js", "./bin/pnpm-dedupe.js"]
    .map((binPath) => fileURLToPath(new URL(binPath, import.meta.url)))
    .find((binPath) => existsSync(binPath));
  if (!built) {
    throw new Error("pnpm-dedupe is not built: run `bun run build` first");
  }
  return built;
})();

// expo-camera's peers (expo, react-native) would drag a few hundred packages in
// and duplicates of their own, none of which this fixture is about.
const workspaceYamlContent = "autoInstallPeers: false\n";

interface Run {
  status: number | null;
  output: string;
}

const projects: string[] = [];

afterEach(() => {
  for (const dir of projects.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const run = (cwd: string, command: string, args: string[]): Run => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
};

const install = (cwd: string, ...args: string[]): Run =>
  run(cwd, "pnpm", [
    "install",
    "--prefer-offline",
    "--ignore-scripts",
    ...args,
  ]);

// node, as the bin's own shebang asks for
const dedupe = (cwd: string, ...args: string[]): Run =>
  run(cwd, "node", [dedupeBin, ...args]);

const lockPath = (dir: string): string => join(dir, "pnpm-lock.yaml");

const resolutionsOf = (dir: string, packageName: string): string[] => {
  const lock = readPnpmLock(lockPath(dir));
  const packagesMap = buildPnpmPackagesMap(parsePnpmLockPackages(lock));
  return (packagesMap[packageName] ?? []).map(({ resolution }) => resolution);
};

const suite = pnpmAvailable ? describe : describe.skip;

suite("pnpm-dedupe end to end", () => {
  it("converges the cluster and leaves pnpm holding it without an override", () => {
    const dir = mkdtempSync(join(tmpdir(), "pnpm-dedup-e2e-"));
    projects.push(dir);
    // only the manifest: the lockfile has to be the real resolution pnpm writes
    // here, not the trimmed one the unit-test fixture commits
    cpSync(join(fixtureDir, "package.json"), join(dir, "package.json"));
    writeFileSync(join(dir, "pnpm-workspace.yaml"), workspaceYamlContent);

    const installed = install(dir);
    strictEqual(installed.status, 0, installed.output);

    // `@yudiel/react-qr-scanner` pins barcode-detector at exactly 3.0.3 while
    // expo-camera's `^3.0.0` resolved to 3.2.2, and the pair drags zxing-wasm
    // along: four resolutions for two packages.
    const before = readDuplicateSnapshot(lockPath(dir));
    strictEqual(before.size, 4, [...before].join(", "));
    ok(before.has("barcode-detector@3.0.3"));
    ok(before.has("barcode-detector@3.2.2"));

    const applied = dedupe(dir);
    strictEqual(applied.status, 0, applied.output);

    // the tool's own verdict: the convergence override went in, came back out,
    // and the result survived the re-resolution without it
    ok(applied.output.includes('"barcode-detector@": "3.0.3"'), applied.output);
    ok(
      applied.output.includes(
        "Removing the overrides and re-resolving to check the result holds",
      ),
      applied.output,
    );
    ok(
      applied.output.includes("Cluster fixes: 4 duplicate resolutions -> 0"),
      applied.output,
    );

    // what matters is the lockfile pnpm was left with
    strictEqual(readDuplicateSnapshot(lockPath(dir)).size, 0);
    deepStrictEqual(resolutionsOf(dir, "barcode-detector"), [
      "barcode-detector@3.0.3",
    ]);
    // barcode-detector 3.2.2 pinned zxing-wasm at exactly 3.1.3; 3.0.3 asks for
    // `^2.1.2`, so converging onto it has to bring the 2.x line back — a 3.1.3
    // left standing would be a range the installed tree contradicts.
    const zxing = resolutionsOf(dir, "zxing-wasm");
    strictEqual(zxing.length, 1, zxing.join(", "));
    ok(zxing[0]?.startsWith("zxing-wasm@2."), zxing.join(", "));

    // no standing override is left behind, in a file otherwise untouched
    strictEqual(
      readFileSync(join(dir, "pnpm-workspace.yaml"), "utf8"),
      workspaceYamlContent,
    );

    // and pnpm itself agrees, from the manifests alone
    const frozen = install(dir, "--frozen-lockfile");
    strictEqual(frozen.status, 0, frozen.output);

    // pnpm's own account of the installed tree, not ours: one copy, reached
    // from both dependents
    const list = run(dir, "pnpm", ["list", "--depth", "Infinity"]);
    strictEqual(list.status, 0, list.output);
    ok(list.output.includes("barcode-detector@3.0.3 [deduped]"), list.output);
    strictEqual(list.output.includes("barcode-detector@3.2.2"), false);

    const check = dedupe(dir, "--check");
    strictEqual(check.status, 0, check.output);
    ok(check.output.includes("Nothing to dedupe."), check.output);
  }, 180_000);
});
