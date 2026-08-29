import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import { readPnpmLock } from "../readPnpmLock.ts";
import { buildPnpmPackagesMap } from "./buildPnpmPackagesMap.ts";
import { parsePnpmLockPackages } from "./parsePnpmLockPackages.ts";
import { toLockstepGraph } from "./toLockstepGraph.ts";

const fixturesBase = (rel: string) =>
  fileURLToPath(new URL(rel, import.meta.url));

const graphOf = (lock: PnpmLockFile) =>
  toLockstepGraph(lock, buildPnpmPackagesMap(parsePnpmLockPackages(lock)));

const graphFor = (scenario: string) =>
  graphOf(
    readPnpmLock(
      fixturesBase(`../../test/fixtures/${scenario}/pnpm-lock.yaml`),
    ),
  );

describe("toLockstepGraph", () => {
  it("strips peer suffixes, resolves aliases, and keeps every installation", () => {
    const graph = graphOf({
      lockfileVersion: "9.0",
      packages: {
        "a@1.0.0": {},
        "b@1.0.0": {},
        "alias-target@2.0.0": {},
      },
      snapshots: {
        "a@1.0.0(peer@1.0.0)": {
          dependencies: {
            b: "1.0.0(peer@1.0.0)",
            aliased: "alias-target@2.0.0",
          },
        },
        "a@1.0.0(peer@2.0.0)": {
          dependencies: { b: "1.0.0" },
        },
        "b@1.0.0": {},
        "alias-target@2.0.0": {},
      },
    });

    // one entry per peer context, both carrying the same resolved version
    deepStrictEqual(graph.a, [
      {
        version: "1.0.0",
        isNpm: true,
        dependencies: { b: "1.0.0", "alias-target": "2.0.0" },
      },
      { version: "1.0.0", isNpm: true, dependencies: { b: "1.0.0" } },
    ]);
  });

  it("maps metro's exact self-pins to co-version edges", () => {
    const metro = graphFor("wildcard-not-reused").metro;
    ok(metro);
    deepStrictEqual(metro.map((resolution) => resolution.version).toSorted(), [
      "0.84.5",
      "0.87.0",
    ]);

    for (const resolution of metro) {
      strictEqual(resolution.isNpm, true);
      strictEqual(resolution.dependencies["metro-config"], resolution.version);
      // an unrelated dependency keeps its own version line
      ok(resolution.dependencies.debug?.startsWith("4."));
    }
  });

  // `aliased-swapped-names`: the keys the importer uses name each other's
  // package. The graph is keyed by npm name, so `@typescript/typescript6` has to
  // stay its own name and `tool`'s edge has to land on the real `typescript`.
  it("keeps swapped alias keys apart", () => {
    const graph = graphFor("aliased-swapped-names");

    deepStrictEqual(Object.keys(graph).toSorted(), [
      "@typescript/typescript6",
      "tool",
      "typescript",
    ]);
    deepStrictEqual(graph.tool?.[0]?.dependencies, { typescript: "5.9.3" });
    strictEqual(graph.typescript?.length, 2);
  });

  it("marks non-npm resolutions so cluster detection skips them", () => {
    const nonNpm = Object.values(graphFor("non-npm"))
      .flat()
      .filter((resolution) => !resolution.isNpm);
    ok(nonNpm.length > 0);
    for (const resolution of nonNpm) {
      deepStrictEqual(resolution.dependencies, {});
    }
  });
});
