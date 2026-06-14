import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { PackageResolution } from "./helpers/buildPackagesMap.ts";
import type { Dependent } from "./helpers/collectDependents.ts";
import { identifyResolutionFixes } from "./identifyResolutionFixes.ts";

const loadResolutionsFixture = (fileName: string): PackageResolution[] => {
  return JSON.parse(
    fs.readFileSync(
      fileURLToPath(
        new URL(`../test/fixtures/resolutions/${fileName}`, import.meta.url),
      ),
      // eslint-disable-next-line unicorn/prefer-json-parse-buffer
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
      // eslint-disable-next-line unicorn/prefer-json-parse-buffer
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
    expect(fixes).toEqual([]);
  });

  it("should return an empty array when there is only one resolution", () => {
    const resolutions = loadResolutionsFixture("semver-7.7.3.json");
    const dependents = loadDependentsFixture("semver-7.7.3.json");
    const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
    expect(fixes).toEqual([]);
  });

  it("should not identify fixes when dependencies are not compatible", () => {
    const resolutions = loadResolutionsFixture(
      "babel-code-frame-7.26.2-7.27.1.json",
    );
    const dependents = loadDependentsFixture(
      "babel-code-frame-7.26.2-7.27.1.json",
    );
    const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
    expect(fixes).toEqual([]);
  });

  it("should identify resolution fixes when dependencies are compatible", () => {
    const resolutions = loadResolutionsFixture(
      "printable-shell-command-5.0.7-5.0.8.json",
    );
    const dependents = loadDependentsFixture(
      "printable-shell-command-5.0.7-5.0.8.json",
    );

    const fixes = identifyResolutionFixes(resolutions, objetToMap(dependents));
    expect(fixes).toEqual([
      {
        megeableResolutions: [
          "printable-shell-command@5.0.7",
          "printable-shell-command@5.0.8",
        ],
        to: "printable-shell-command@5.0.8",
      },
    ]);
  });
});
