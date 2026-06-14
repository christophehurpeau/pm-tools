import { ok, strictEqual } from "node:assert/strict";
import { describe, it } from "bun:test";
import { applyIdentifiedFixesToBunLock } from "./applyIdentifiedFixesToBunLock.js";
describe("applyIdentifiedFixesToBunLock", () => {
    it("replaces megeable resolutions with target resolution", () => {
        const bunLock = {
            lockfileVersion: 1,
            workspaces: {},
            packages: {
                pkg: ["pkg@1.0.0", "meta1"],
                "pkg-dup": ["pkg@0.9.0", "meta2"],
            },
        };
        const identified = new Map([
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
//# sourceMappingURL=applyIdentifiedFixesToBunLock.test.js.map