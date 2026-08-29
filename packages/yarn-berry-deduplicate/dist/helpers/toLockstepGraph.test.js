import { describe, expect, it } from "bun:test";
import { loadFixture } from "./fixtures.js";
import { toLockstepGraph } from "./toLockstepGraph.js";
describe("toLockstepGraph", () => {
    it("carries each resolution's version and requested ranges", () => {
        const { packagesMap } = loadFixture("wildcard-not-reused");
        expect(toLockstepGraph(packagesMap)["mini-metro"]).toEqual([
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
        expect(toLockstepGraph(packagesMap).resolve).toEqual([
            { version: "1.22.10", isNpm: true, dependencies: {} },
            { version: "", isNpm: false, dependencies: {} },
        ]);
    });
    // an edge sits under the key the requester declared, and cluster detection
    // matches names, so an alias must not appear as a package of its own
    it("resolves an aliased edge to the package it names", () => {
        const { packagesMap } = loadFixture("mergeable-alias");
        const graph = toLockstepGraph(packagesMap);
        expect(graph["printable-shell-command"]).toHaveLength(2);
        expect(graph.psc).toBeUndefined();
    });
    it("resolves an aliased dependency edge onto the target's name", () => {
        const { packagesMap } = loadFixture("wildcard-not-reused");
        const plugin = toLockstepGraph(packagesMap)["mini-plugin"]?.[0];
        expect(plugin?.dependencies).toEqual({ "mini-metro-config": "*" });
    });
});
//# sourceMappingURL=toLockstepGraph.test.js.map