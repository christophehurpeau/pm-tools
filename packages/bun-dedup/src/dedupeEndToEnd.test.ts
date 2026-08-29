import { afterEach, describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPackagesMap } from "./helpers/buildPackagesMap.ts";
import { readDuplicateSnapshot } from "./helpers/duplicateSnapshot.ts";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
import { createTempProjects } from "./helpers/tempProjects.ts";
import { readAndParseBunLock } from "./readAndParseBunLock.ts";

// The shipped tool against a real bun: a copy of the
// `exact-pin-forces-downgrade` fixture, a real `bun install`, then the built
// `bun-dedupe` bin as a user would run it and the `bun i` it asks for. Every
// other test stubs the resolution step, so this is the only one that can tell
// whether bun holds the merged version — nothing left pinning it, no override,
// only the manifests and the rewritten lockfile — and bun is asked for its own
// account of the installed tree at the end rather than only our reading of it.
//
// Requires network access or a warm bun cache.

const fixtureDir = fileURLToPath(
  new URL("../test/fixtures/exact-pin-forces-downgrade", import.meta.url),
);
// the built bin, the one the `bin` field points at: from `src` it is one level
// up, and the compiled copy of this file sits beside it
const dedupeBin = ((): string => {
  const built = ["../dist/bin/bun-dedupe.js", "./bin/bun-dedupe.js"]
    .map((binPath) => fileURLToPath(new URL(binPath, import.meta.url)))
    .find((binPath) => existsSync(binPath));
  if (!built) {
    throw new Error("bun-dedupe is not built: run `bun run build` first");
  }
  return built;
})();

interface Run {
  status: number | null;
  output: string;
}

const projects = createTempProjects("bun-dedup-e2e-");

afterEach(projects.cleanup);

const run = (cwd: string, args: string[]): Run => {
  const result = spawnSync("bun", args, {
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
  run(cwd, ["install", ...args]);

const dedupe = (cwd: string, ...args: string[]): Run =>
  run(cwd, [dedupeBin, ...args]);

const lockPath = (dir: string): string => join(dir, "bun.lock");

const resolutionsOf = (dir: string, packageName: string): string[] => {
  const packagesMap = buildPackagesMap(
    parseBunLockPackages(readAndParseBunLock(lockPath(dir))),
  );
  return (packagesMap[packageName] ?? []).map(({ resolution }) => resolution);
};

const installedVersion = (dir: string, packageName: string): string =>
  (
    JSON.parse(
      readFileSync(
        join(dir, "node_modules", packageName, "package.json"),
        "utf8",
      ),
    ) as { version: string }
  ).version;

describe("bun-dedupe end to end", () => {
  it("merges onto the pinned version and leaves bun installing it", () => {
    const dir = projects.create();
    // The lockfile comes along: bun resolves peers into it, and a fresh resolve
    // of expo-camera would pull the whole expo/react-native tree in with
    // duplicates of its own. The committed one is exactly the duplicate this
    // fixture is about, and `bun install` installs it as it stands.
    for (const file of ["package.json", "bun.lock"]) {
      cpSync(join(fixtureDir, file), join(dir, file));
    }
    const manifestBefore = readFileSync(join(dir, "package.json"), "utf8");

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
    ok(applied.output.includes("bun.lock updated"), applied.output);
    // what it deduped, named: one copy of each package merged away, both sides
    // counted so converging onto the older 3.0.3 does not read as a downgrade
    ok(
      applied.output.includes("Deduped 2 packages, 2 copies merged:"),
      applied.output,
    );
    ok(
      applied.output.includes(
        "barcode-detector: 2 versions (3.0.3, 3.2.2) -> 1 version (3.0.3)",
      ),
      applied.output,
    );

    // the rewrite only asks; bun is what applies it
    const reinstalled = install(dir);
    strictEqual(reinstalled.status, 0, reinstalled.output);

    strictEqual(readDuplicateSnapshot(lockPath(dir)).size, 0);
    deepStrictEqual(resolutionsOf(dir, "barcode-detector"), [
      "barcode-detector@3.0.3",
    ]);
    // barcode-detector 3.2.2 pinned zxing-wasm at exactly 3.1.3; 3.0.3 asks for
    // `^2.1.2`, so converging onto it has to bring the 2.x line back. A 3.1.3
    // left standing here is a range the installed tree contradicts.
    const zxing = resolutionsOf(dir, "zxing-wasm");
    strictEqual(zxing.length, 1, zxing.join(", "));
    ok(zxing[0]?.startsWith("zxing-wasm@2."), zxing.join(", "));

    // the same thing again, read from what bun actually put on disk
    strictEqual(installedVersion(dir, "barcode-detector"), "3.0.3");
    ok(
      installedVersion(dir, "zxing-wasm").startsWith("2."),
      installedVersion(dir, "zxing-wasm"),
    );

    // nothing was pinned into the manifest to hold it there
    strictEqual(
      readFileSync(join(dir, "package.json"), "utf8"),
      manifestBefore,
    );

    // and bun agrees the lockfile is one CI could install from as it stands
    const frozen = install(dir, "--frozen-lockfile");
    strictEqual(frozen.status, 0, frozen.output);

    // bun's own account of the installed tree, not ours: one copy of each, and
    // no nested one left under a dependent
    const list = run(dir, ["pm", "ls", "--all"]);
    strictEqual(list.status, 0, list.output);
    const listed = list.output
      .split("\n")
      .map((line) => line.replace(/^[\s│├└─]+/u, "").trim())
      .filter((line) => /^(?:barcode-detector|zxing-wasm)@/u.test(line));
    strictEqual(listed.length, 2, list.output);
    ok(listed.includes("barcode-detector@3.0.3"), list.output);
    ok(
      listed.some((line) => line.startsWith("zxing-wasm@2.")),
      list.output,
    );

    const check = dedupe(dir, "--check");
    strictEqual(check.status, 0, check.output);
    ok(check.output.includes("Nothing to dedupe."), check.output);
  }, 180_000);
});
