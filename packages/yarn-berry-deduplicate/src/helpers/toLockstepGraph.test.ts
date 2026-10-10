import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture } from "./fixtures.ts";
import { toLockstepGraph } from "./toLockstepGraph.ts";

describe("toLockstepGraph", () => {
  it("carries each resolution's version and requested ranges", () => {
    const { packagesMap } = loadFixture("wildcard-not-reused");

    deepStrictEqual(toLockstepGraph(packagesMap)["mini-metro"], [
      {
        version: "0.84.5",
        isNpm: true,
        dependencies: { "mini-metro-config": "0.84.5" },
      },
      {
        version: "0.87.0",
        isNpm: true,
        dependencies: { "mini-metro-config": "0.87.0" },
      },
    ]);
  });

  it("marks a non-npm resolution so cluster detection skips it", () => {
    const { packagesMap } = loadFixture("non-npm");

    deepStrictEqual(toLockstepGraph(packagesMap).resolve, [
      { version: "1.22.10", isNpm: true, dependencies: {} },
      { version: "", isNpm: false, dependencies: {} },
    ]);
  });

  // an edge sits under the key the requester declared, and cluster detection
  // matches names, so an alias must not appear as a package of its own
  it("resolves an aliased edge to the package it names", () => {
    const { packagesMap } = loadFixture("mergeable-alias");
    const graph = toLockstepGraph(packagesMap);

    strictEqual(graph["printable-shell-command"]?.length, 2);
    strictEqual(graph.psc, undefined);
  });

  it("resolves an aliased dependency edge onto the target's name", () => {
    const { packagesMap } = loadFixture("wildcard-not-reused");
    const plugin = toLockstepGraph(packagesMap)["mini-plugin"]?.[0];

    deepStrictEqual(plugin?.dependencies, { "mini-metro-config": "*" });
  });
});
