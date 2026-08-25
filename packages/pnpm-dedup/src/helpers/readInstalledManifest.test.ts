import { describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createManifestReaderWithStats } from "./readInstalledManifest.ts";

const hoistedFixture = fileURLToPath(
  new URL("../../test/fixtures/hoisted-node-linker", import.meta.url),
);

describe("createManifestReaderWithStats", () => {
  it("reads a hoisted layout, top-level and nested", () => {
    const { readManifest, stats } =
      createManifestReaderWithStats(hoistedFixture);

    // hoisted at the top of node_modules
    deepStrictEqual(readManifest("mini-metro", "0.84.5")?.dependencies, {
      "mini-metro-config": "0.84.5",
    });
    // the version that lost the hoist, nested under its dependent
    deepStrictEqual(readManifest("mini-metro", "0.87.0")?.dependencies, {
      "mini-metro-config": "0.87.0",
    });
    // the open range this whole scenario turns on
    deepStrictEqual(readManifest("mini-plugin", "1.0.0")?.dependencies, {
      "mini-metro-config": "*",
    });

    deepStrictEqual(stats(), { found: 3, missed: 0 });
  });

  it("resolves a location only pnpm's own index knows", () => {
    const { readManifest } = createManifestReaderWithStats(hoistedFixture);

    // three levels down: reachable from `.modules.yaml`'s hoistedLocations,
    // not from scanning node_modules one level deep
    deepStrictEqual(readManifest("mini-deep", "2.0.0")?.dependencies, {
      "mini-metro-config": "*",
    });
  });

  it("does not return a manifest whose version differs", () => {
    const { readManifest, stats } =
      createManifestReaderWithStats(hoistedFixture);

    strictEqual(readManifest("mini-metro", "9.9.9"), undefined);
    deepStrictEqual(stats(), { found: 0, missed: 1 });
  });

  it("reads pnpm's virtual store layout, peer suffix included", () => {
    const dir = mkdtempSync(join(tmpdir(), "pnpm-dedup-virtual-store-"));
    try {
      const packageDir = join(
        dir,
        "node_modules",
        ".pnpm",
        "@scope+pkg@1.2.3(react@19.0.0)",
        "node_modules",
        "@scope",
        "pkg",
      );
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(
        join(packageDir, "package.json"),
        JSON.stringify({
          name: "@scope/pkg",
          version: "1.2.3",
          peerDependencies: { react: "*" },
        }),
      );

      const { readManifest, stats } = createManifestReaderWithStats(dir);
      deepStrictEqual(readManifest("@scope/pkg", "1.2.3")?.peerDependencies, {
        react: "*",
      });
      deepStrictEqual(stats(), { found: 1, missed: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors a relocated virtual store", () => {
    const dir = mkdtempSync(join(tmpdir(), "pnpm-dedup-relocated-store-"));
    try {
      const packageDir = join(
        dir,
        "node_modules",
        ".pnpm-store",
        "pkg@1.0.0",
        "node_modules",
        "pkg",
      );
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(
        join(packageDir, "package.json"),
        JSON.stringify({ name: "pkg", version: "1.0.0", dependencies: {} }),
      );
      writeFileSync(
        join(dir, "node_modules", ".modules.yaml"),
        JSON.stringify({
          nodeLinker: "isolated",
          virtualStoreDir: ".pnpm-store",
        }),
      );

      const { readManifest } = createManifestReaderWithStats(dir);
      strictEqual(readManifest("pkg", "1.0.0")?.version, "1.0.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports every read as missed when nothing is installed", () => {
    const { readManifest, stats } = createManifestReaderWithStats(
      join(tmpdir(), "pnpm-dedup-not-installed"),
    );

    strictEqual(readManifest("mini-metro", "0.84.5"), undefined);
    strictEqual(readManifest("mini-plugin", "1.0.0"), undefined);
    deepStrictEqual(stats(), { found: 0, missed: 2 });
  });
});
