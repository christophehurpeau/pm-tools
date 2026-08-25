import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { buildIdentifiedFixesMap } from "./buildIdentifiedFixesMap.js";
describe("buildIdentifiedFixesMap", () => {
    it("builds a map even when there are no fixes", () => {
        const fakeResolution = {
            resolution: "pkg@1.0.0",
            package: {
                type: "npm",
                name: "pkg",
                resolution: "pkg@1.0.0",
                version: "1.0.0",
                registry: "",
                info: {},
                integrity: "",
            },
            installations: ["pkg"],
        };
        const duplicates = {
            pkg: [fakeResolution],
        };
        const dependents = new Map();
        const map = buildIdentifiedFixesMap(duplicates, dependents);
        ok(map instanceof Map);
        strictEqual(map.has("pkg"), true);
        strictEqual(Array.isArray(map.get("pkg")), true);
        strictEqual((map.get("pkg") || []).length, 0);
    });
});
//# sourceMappingURL=buildIdentifiedFixesMap.test.js.map