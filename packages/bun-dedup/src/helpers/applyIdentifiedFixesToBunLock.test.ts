import type { BunLockFile } from "bun";
import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { applyIdentifiedFixesToBunLock } from "./applyIdentifiedFixesToBunLock.ts";

describe("applyIdentifiedFixesToBunLock", () => {
  it("replaces megeable resolutions with target resolution", () => {
    const bunLock: BunLockFile & { packages: Record<string, any> } = {
      lockfileVersion: 1,
      workspaces: {},
      packages: {
        pkg: ["pkg@1.0.0", "meta1"],
        "pkg-dup": ["pkg@0.9.0", "meta2"],
      },
    };

    const identified = new Map<
      string,
      { megeableResolutions: string[]; to: string }[]
    >([
      [
        "pkg",
        [
          {
            megeableResolutions: ["pkg@0.9.0", "pkg@1.0.0"],
            to: "pkg@1.0.0",
          },
        ],
      ],
    ]);

    const result = applyIdentifiedFixesToBunLock(bunLock, identified);

    strictEqual(result.changed, true);
    strictEqual(bunLock.packages["pkg-dup"][0], "pkg@1.0.0");
    ok(Array.isArray(bunLock.packages["pkg-dup"]));
    ok(result.changedKeys.includes("pkg-dup"));
  });
});
