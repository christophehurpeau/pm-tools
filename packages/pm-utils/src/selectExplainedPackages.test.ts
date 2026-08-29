import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { createPackageFilter } from "./createPackageFilter.ts";
import type { PackageFilterOptions } from "./createPackageFilter.ts";
import { selectExplainedPackages } from "./selectExplainedPackages.ts";

const packagesMap: Record<string, string[]> = {
  metro: ["metro@0.84.5", "metro@0.87.0"],
  lodash: ["lodash@4.17.21"],
  semver: ["semver@7.6.0"],
};

const select = (
  filterOptions: PackageFilterOptions,
  all = false,
): ReturnType<typeof selectExplainedPackages<string[]>> =>
  selectExplainedPackages({
    packagesMap,
    filter: createPackageFilter(filterOptions),
    all,
  });

describe("selectExplainedPackages", () => {
  it("keeps only the duplicated packages of the selection", () => {
    const { packages, title, notice } = select({});
    deepStrictEqual(Object.keys(packages), ["metro"]);
    strictEqual(title, "duplicates");
    strictEqual(notice, undefined);
  });

  it("keeps a named package that is not duplicated, to show its dependents", () => {
    const { packages, title, notice } = select({ include: ["lodash"] });
    deepStrictEqual(Object.keys(packages), ["lodash"]);
    strictEqual(title, "matches");
    strictEqual(notice, "lodash is not duplicated. Showing its dependents:");
  });

  it("names every match when several are selected and none is duplicated", () => {
    const { packages, notice } = select({ include: ["lodash", "semver"] });
    deepStrictEqual(Object.keys(packages), ["lodash", "semver"]);
    ok(notice?.startsWith("None of the 2 matches is duplicated"));
    ok(notice?.includes("lodash, semver"));
  });

  it("drops the single-version matches as soon as one selection is duplicated", () => {
    const { packages, title, notice } = select({
      include: ["lodash", "metro"],
    });
    deepStrictEqual(Object.keys(packages), ["metro"]);
    strictEqual(title, "duplicates");
    strictEqual(notice, undefined);
  });

  it("reports nothing for a package the lockfile does not hold", () => {
    const { packages, title, notice } = select({ include: ["missing"] });
    deepStrictEqual(Object.keys(packages), []);
    strictEqual(title, "duplicates");
    strictEqual(notice, undefined);
  });

  it("keeps every match under --all without a notice", () => {
    const { packages, title, notice } = select({}, true);
    deepStrictEqual(Object.keys(packages), ["metro", "lodash", "semver"]);
    strictEqual(title, "matches");
    strictEqual(notice, undefined);
  });
});
