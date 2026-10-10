import { deepStrictEqual } from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { identifyResolutionFixes } from "pm-dedup-core";
import type { PackageResolution } from "./helpers/buildPnpmPackagesMap.ts";
import type { Dependent } from "./helpers/collectPnpmDependents.ts";

const loadResolutionsFixture = (fileName: string): PackageResolution[] => {
  return JSON.parse(
    fs.readFileSync(
      fileURLToPath(
        new URL(`../test/fixtures/resolutions/${fileName}`, import.meta.url),
      ),
      // oxlint-disable-next-line unicorn-js/prefer-json-parse-buffer
      "utf8",
    ),
  );
};

const loadDependentsFixture = (
  fileName: string,
): Record<string, Dependent[]> => {
  return JSON.parse(
    fs.readFileSync(
      fileURLToPath(
        new URL(`../test/fixtures/dependents/${fileName}`, import.meta.url),
      ),
      // oxlint-disable-next-line unicorn-js/prefer-json-parse-buffer
      "utf8",
    ),
  );
};

const objetToMap = <K extends string, V>(obj: Record<K, V>): Map<K, V> =>
  new Map(Object.entries(obj) as [K, V][]);

describe("identifyResolutionFixes", () => {
  it("should return an empty array when there are no resolutions", () => {
    const resolutions: PackageResolution[] = [];

    const fixes = identifyResolutionFixes(resolutions, objetToMap({}));
    deepStrictEqual(fixes, []);
  });

  it("should return an empty array when there is only one resolution", () => {
    const resolutions = loadResolutionsFixture("semver-7.7.3.json");
    const dependents = loadDependentsFixture("semver-7.7.3.json");
    const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
    deepStrictEqual(fixes, []);
  });

  it("should not identify fixes when dependencies are not compatible", () => {
    const resolutions = loadResolutionsFixture(
      "babel-code-frame-7.26.2-7.27.1.json",
    );
    const dependents = loadDependentsFixture(
      "babel-code-frame-7.26.2-7.27.1.json",
    );
    const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
    deepStrictEqual(fixes, []);
  });

  it("should identify resolution fixes when dependencies are compatible", () => {
    const resolutions = loadResolutionsFixture(
      "printable-shell-command-5.0.7-5.0.8.json",
    );
    const dependents = loadDependentsFixture(
      "printable-shell-command-5.0.7-5.0.8.json",
    );

    const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
    deepStrictEqual(fixes, [
      {
        mergeableResolutions: [
          "printable-shell-command@5.0.7",
          "printable-shell-command@5.0.8",
        ],
        to: "printable-shell-command@5.0.8",
      },
    ]);
  });
});
