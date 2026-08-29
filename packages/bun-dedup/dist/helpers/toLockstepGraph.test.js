import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { readAndParseBunLock } from "../readAndParseBunLock.js";
import { buildPackagesMap } from "./buildPackagesMap.js";
import { parseBunLockPackages } from "./parseBunLockPackages.js";
import { toLockstepGraph } from "./toLockstepGraph.js";
const graphOfFixture = (relativeLockPath) => {
    const bunLock = readAndParseBunLock(fileURLToPath(new URL(relativeLockPath, import.meta.url)));
    return toLockstepGraph(buildPackagesMap(parseBunLockPackages(bunLock)));
};
describe("toLockstepGraph", () => {
    // `aliased-nested`: `plugin` declares `"semver-legacy": "npm:semver@^6.0.0"`.
    // Cluster detection matches edges against graph names, which are npm names, so
    // an edge left under its alias points at nothing and the family member it
    // reaches never joins the cluster.
    it("resolves an aliased edge onto the name it targets", () => {
        const graph = graphOfFixture("../../test/fixtures/aliased-nested/bun.lock");
        expect(graph.plugin?.[0]?.dependencies).toEqual({
            helper: "^1.0.0",
            semver: "^6.0.0",
        });
    });
    // `aliased-swapped-names`: `tool` declares the real `typescript`, and the
    // `typescript` key the root uses for another package must not reach the graph
    // as an edge to `typescript`.
    it("keeps a swapped alias key out of the edges", () => {
        const graph = graphOfFixture("../../test/fixtures/aliased-swapped-names/bun.lock");
        expect(graph.tool?.[0]?.dependencies).toEqual({ typescript: "^5.9.0" });
        expect(Object.keys(graph).toSorted()).toEqual([
            "@typescript/typescript6",
            "tool",
            "typescript",
        ]);
    });
    // A declaration semver cannot read constrains no version, and `isCoVersion`
    // would only ever read it as "not co-version" anyway.
    it("drops declarations that are not npm ranges", () => {
        const graph = graphOfFixture("../../test/fixtures/non-npm/bun.lock");
        for (const resolutions of Object.values(graph)) {
            for (const resolution of resolutions) {
                for (const range of Object.values(resolution.dependencies)) {
                    expect(range).not.toContain(":");
                }
            }
        }
    });
});
//# sourceMappingURL=toLockstepGraph.test.js.map