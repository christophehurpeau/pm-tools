import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { buildIdentifiedFixesMap } from "./buildIdentifiedFixesMap.ts";
import type { PackageResolution, PackagesMap } from "./buildPnpmPackagesMap.ts";
import type { DependentsMap } from "./collectPnpmDependents.ts";

describe("buildIdentifiedFixesMap", () => {
  it("builds a map even when there are no fixes", () => {
    const fakeResolution: PackageResolution = {
      resolution: "pkg@1.0.0",
      package: {
        type: "npm",
        name: "pkg",
        resolution: "pkg@1.0.0",
        version: "1.0.0",
      },
      installations: ["pkg@1.0.0"],
    };

    const duplicates: PackagesMap = {
      pkg: [fakeResolution],
    };

    const dependents: DependentsMap = new Map();

    const map = buildIdentifiedFixesMap(duplicates, dependents);

    ok(map instanceof Map);
    strictEqual(map.has("pkg"), true);
    strictEqual(Array.isArray(map.get("pkg")), true);
    strictEqual((map.get("pkg") || []).length, 0);
  });
});
