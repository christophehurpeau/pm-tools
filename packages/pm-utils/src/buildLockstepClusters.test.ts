import { describe, expect, it } from "bun:test";
import {
  type LockstepGraph,
  buildLockstepClusters,
} from "./buildLockstepClusters.ts";

const npm = (
  version: string,
  dependencies: Record<string, string> = {},
): { version: string; isNpm: true; dependencies: Record<string, string> } => ({
  version,
  isNpm: true,
  dependencies,
});

describe("buildLockstepClusters", () => {
  it("unions a co-versioned family across caret and exact pins", () => {
    // a@1 and a@2 both request b/c at their own version; b requests c at its
    // own version. `noise` is requested at an unrelated version by everyone.
    const graph: LockstepGraph = {
      a: [
        npm("1.0.0", { b: "1.0.0", c: "^1.0.0", noise: "^3.0.0" }),
        npm("2.0.0", { b: "2.0.0", c: "^2.0.0", noise: "^3.0.0" }),
      ],
      b: [npm("1.0.0", { c: "1.0.0" }), npm("2.0.0", { c: "2.0.0" })],
      c: [npm("1.0.0"), npm("2.0.0")],
      noise: [npm("3.1.0"), npm("3.2.0")],
    };

    const clusters = buildLockstepClusters(graph);

    expect(clusters).toEqual([["a", "b", "c"]]);
  });

  it("does not union when a version observation breaks co-version", () => {
    // a@2 requests b at b's matching version, but a@1 requests b at a stale
    // version: not every observation co-versions, so no union.
    const graph: LockstepGraph = {
      a: [npm("1.0.0", { b: "2.0.0" }), npm("2.0.0", { b: "2.0.0" })],
      b: [npm("1.0.0"), npm("2.0.0")],
    };

    expect(buildLockstepClusters(graph)).toEqual([]);
  });

  it("does not union when the anchor version is not installed", () => {
    // Real case: `d@1.0.1` requests `type@^1.0.1`, so the range anchors on
    // d's own version by coincidence — no `type@1.0.1` is installed, the
    // request resolves to `type@1.2.0`, and the two do not move together.
    const graph: LockstepGraph = {
      d: [npm("1.0.1", { type: "^1.0.1" })],
      esniff: [npm("2.0.1", { d: "^1.0.1", type: "^2.7.2" })],
      type: [npm("1.2.0"), npm("2.7.2")],
    };

    expect(buildLockstepClusters(graph)).toEqual([]);
  });

  it("unions when the anchor version is installed alongside others", () => {
    // Same shape, but the lock does carry `b@1.0.0`: the pin is real, and the
    // duplicate `b@1.2.0` is what the cluster pass exists to collapse.
    const graph: LockstepGraph = {
      a: [npm("1.0.0", { b: "^1.0.0" })],
      b: [npm("1.0.0"), npm("1.2.0")],
    };

    expect(buildLockstepClusters(graph)).toEqual([["a", "b"]]);
  });

  it("keeps unioning pnpm-style edges that store the resolved version", () => {
    // pnpm records the resolved version, so the anchor is installed by
    // construction and detection is unchanged.
    const graph: LockstepGraph = {
      a: [npm("7.28.0", { b: "7.28.0" })],
      b: [npm("7.28.0")],
    };

    expect(buildLockstepClusters(graph)).toEqual([["a", "b"]]);
  });

  it("ignores edges to packages absent from the graph and non-npm resolutions", () => {
    const graph: LockstepGraph = {
      a: [npm("1.0.0", { missing: "1.0.0", b: "1.0.0" })],
      b: [npm("1.0.0")],
      w: [{ version: "", isNpm: false, dependencies: { a: "1.0.0" } }],
    };

    expect(buildLockstepClusters(graph)).toEqual([["a", "b"]]);
  });
});
