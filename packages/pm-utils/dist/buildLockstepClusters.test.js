import { describe, expect, it } from "bun:test";
import { buildLockstepClusters, } from "./buildLockstepClusters.js";
const npm = (version, dependencies = {}) => ({
    version,
    isNpm: true,
    dependencies,
});
describe("buildLockstepClusters", () => {
    it("unions a co-versioned family across caret and exact pins", () => {
        // a@1 and a@2 both request b/c at their own version; b requests c at its
        // own version. `noise` is requested at an unrelated version by everyone.
        const graph = {
            a: [
                npm("1.0.0", { b: "1.0.0", c: "^1.0.0", noise: "^3.0.0" }),
                npm("2.0.0", { b: "2.0.0", c: "^2.0.0", noise: "^3.0.0" }),
            ],
            b: [
                npm("1.0.0", { c: "1.0.0" }),
                npm("2.0.0", { c: "2.0.0" }),
            ],
            c: [npm("1.0.0"), npm("2.0.0")],
            noise: [npm("3.1.0"), npm("3.2.0")],
        };
        const clusters = buildLockstepClusters(graph);
        expect(clusters).toEqual([["a", "b", "c"]]);
    });
    it("does not union when a version observation breaks co-version", () => {
        // a@2 requests b at b's matching version, but a@1 requests b at a stale
        // version: not every observation co-versions, so no union.
        const graph = {
            a: [
                npm("1.0.0", { b: "2.0.0" }),
                npm("2.0.0", { b: "2.0.0" }),
            ],
            b: [npm("1.0.0"), npm("2.0.0")],
        };
        expect(buildLockstepClusters(graph)).toEqual([]);
    });
    it("ignores edges to packages absent from the graph and non-npm resolutions", () => {
        const graph = {
            a: [npm("1.0.0", { missing: "1.0.0", b: "1.0.0" })],
            b: [npm("1.0.0")],
            w: [{ version: "", isNpm: false, dependencies: { a: "1.0.0" } }],
        };
        expect(buildLockstepClusters(graph)).toEqual([["a", "b"]]);
    });
});
//# sourceMappingURL=buildLockstepClusters.test.js.map