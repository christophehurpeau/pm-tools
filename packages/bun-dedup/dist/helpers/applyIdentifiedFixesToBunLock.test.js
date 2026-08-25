import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
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
    // The nested entries of the replaced key are the private tree of the version
    // that is gone — here an exact pin the target's own range rejects. Left in
    // place, `bun install` keeps installing them.
    it("drops the nested entries of a replaced resolution", () => {
        const bunLock = {
            lockfileVersion: 1,
            workspaces: {},
            packages: {
                pkg: [
                    "pkg@1.0.0",
                    "",
                    { dependencies: { leaf: "^1.0.0" } },
                    "sha512-1",
                ],
                leaf: ["leaf@1.2.0", "", {}, "sha512-2"],
                "dep/pkg": [
                    "pkg@2.0.0",
                    "",
                    { dependencies: { leaf: "2.0.0" } },
                    "sha512-3",
                ],
                "dep/pkg/leaf": ["leaf@2.0.0", "", {}, "sha512-4"],
            },
        };
        const result = applyIdentifiedFixesToBunLock(bunLock, new Map([
            [
                "pkg",
                [
                    {
                        megeableResolutions: ["pkg@1.0.0", "pkg@2.0.0"],
                        to: "pkg@1.0.0",
                    },
                ],
            ],
        ]));
        strictEqual(bunLock.packages["dep/pkg"][0], "pkg@1.0.0");
        strictEqual("dep/pkg/leaf" in bunLock.packages, false);
        ok(result.changedKeys.includes("dep/pkg/leaf"));
        // the untouched keys stay as they are
        strictEqual(bunLock.packages.leaf[0], "leaf@1.2.0");
    });
});
//# sourceMappingURL=applyIdentifiedFixesToBunLock.test.js.map