import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import type { ClusterFix } from "pm-utils";
import { displayMany } from "./displayMany.ts";
import type { DisplayManyOptions } from "./displayMany.ts";
import {
  buildPackagesMap,
  filterDuplicatesPackagesMap,
} from "./helpers/buildPackagesMap.ts";
import { collectDependents } from "./helpers/collectDependents.ts";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import type { ResolutionFix } from "./identifyResolutionFixes.ts";
import { readAndParseBunLock } from "./readAndParseBunLock.ts";

// The report layout is covered in pm-utils (`renderDuplicatesReport`); these
// only check that the bun.lock model is mapped onto it correctly.
const render = (
  scenario: string,
  overrides: Partial<DisplayManyOptions> = {},
): string => {
  const fixturePath = fileURLToPath(
    new URL(`../test/fixtures/${scenario}/bun.lock`, import.meta.url),
  );
  const bunLock = readAndParseBunLock(fixturePath);
  const packages = parseBunLockPackages(bunLock);
  const packagesMap = buildPackagesMap(packages);
  const duplicates = filterDuplicatesPackagesMap(packagesMap);
  const dependents = collectDependents(
    packages,
    bunLock.workspaces,
    Object.keys(duplicates),
  );

  let buffer = "";
  displayMany({
    title: "duplicates",
    duplicatesPackagesMap: duplicates,
    dependents,
    totalDependencies: Object.keys(packagesMap).length,
    color: false,
    log: (message = "") => {
      buffer += `${message}\n`;
    },
    ...overrides,
  });
  return buffer;
};

const clusterFixesOf = (scenario: string): ClusterFix[] => {
  const fixturePath = fileURLToPath(
    new URL(`../test/fixtures/${scenario}/bun.lock`, import.meta.url),
  );
  const bunLock = readAndParseBunLock(fixturePath);
  const packages = parseBunLockPackages(bunLock);
  return identifyClusterFixes(
    buildPackagesMap(packages),
    packages,
    bunLock.workspaces,
  );
};

const lastLine = (output: string): string =>
  output.trimEnd().split("\n").at(-1)!;

describe("displayMany", () => {
  it("renders resolutions, their install locations and every dependent", () => {
    expect(render("duplicated-babel-frame")).toBe(
      `Found 1 duplicate:

@babel/code-frame:
  Resolutions:
    - @babel/code-frame@7.26.2
    - @babel/code-frame@7.27.1
      Installed at:
        - @babel/core/@babel/code-frame
        - @babel/template/@babel/code-frame
        - @babel/traverse/@babel/code-frame
  Dependents:
    - package.json in dependencies requires "7.26.2"
    - @babel/core requires "^7.25.9", resolved 7.27.1
    - @babel/template requires "^7.27.1", resolved 7.27.1
    - @babel/traverse requires "^7.27.1", resolved 7.27.1

Found 39 dependencies, 1 duplicate, 0 dedupable.
`,
    );
  });

  it("renders duplicates for printable-shell-command", () => {
    expect(render("duplicated-printable-shell-command")).toBe(
      `Found 1 duplicate:

printable-shell-command:
  Resolutions:
    - printable-shell-command@5.0.7
    - printable-shell-command@5.0.8
  Dependents:
    - package.json in dependencies requires "^5.0.7", resolved 5.0.7
    - betterdisplaycli requires "^5.0.8", resolved 5.0.8

Found 6 dependencies, 1 duplicate, 0 dedupable.
`,
    );
  });

  // `exact-pin-forces-downgrade`: bun.lock records `expo-camera`'s `^3.0.0`
  // next to the 3.2.2 it resolved to, so the report can show both instead of
  // making the caret look like an exact pin.
  it("shows the declared range next to the version it resolved to", () => {
    expect(render("exact-pin-forces-downgrade")).toContain(
      `  Dependents:
    - @yudiel/react-qr-scanner requires "3.0.3"
    - expo-camera requires "^3.0.0", resolved 3.2.2
`,
    );
  });

  it("names the downgrade a merge onto an installed copy takes", () => {
    const output = render("exact-pin-forces-downgrade", {
      identifiedFixesMap: new Map([
        [
          "barcode-detector",
          [
            {
              megeableResolutions: [
                "barcode-detector@3.0.3",
                "barcode-detector@3.2.2",
              ],
              to: "barcode-detector@3.0.3",
            },
          ],
        ],
      ]),
    });
    expect(output).toContain("  Dedupe:\n    - 3.2.2 -> 3.0.3 (downgrade)\n");
  });

  it("lists every nested duplicate for typescript-eslint", () => {
    const output = render("duplicated-typescript-eslint");
    expect(output).toStartWith("Found 16 duplicates:\n");
    expect(output).toContain("@typescript-eslint/types:");
    expect(output).toContain('    - eslint-plugin-import-x requires "^8.56.0"');
    // the nested dependent keys bun records are kept verbatim
    expect(output).toContain(
      '    - @typescript-eslint/utils/@typescript-eslint/typescript-estree requires "8.59.1"',
    );
  });

  it("maps a resolution fix to the versions that would collapse", () => {
    const fixes: ResolutionFix[] = [
      {
        megeableResolutions: [
          "printable-shell-command@5.0.7",
          "printable-shell-command@5.0.8",
        ],
        to: "printable-shell-command@5.0.8",
      },
    ];
    const output = render("duplicated-printable-shell-command", {
      identifiedFixesMap: new Map([["printable-shell-command", fixes]]),
    });
    expect(output).toContain("  Dedupe:\n    - 5.0.7 -> 5.0.8 (upgrade)\n");
    expect(lastLine(output)).toBe(
      "Found 6 dependencies, 1 duplicate, 1 dedupable. Run `bun-dedupe` to apply.",
    );
  });

  it("renders the lockstep cluster fix for typescript-eslint", () => {
    const output = render("duplicated-typescript-eslint", {
      clusterFixes: clusterFixesOf("duplicated-typescript-eslint"),
    });

    expect(output).toContain("Lockstep clusters:");
    expect(output).toContain(
      "cluster 1 — @typescript-eslint/* (+1 more) [11 packages, 7 duplicated, 7 fixable]:",
    );
    expect(output).toContain("  Dedupe: 8.59.1 (downgrade)");
    // every member is listed with what it currently has installed
    expect(output).toContain("    - typescript-eslint  ");
    expect(output).toContain("8.61.0, 8.59.1");
    // and the members are cross-referenced back to it
    expect(output).toContain("@typescript-eslint/types:\n  Cluster: 1\n");
  });

  it("names the bun command in the summary", () => {
    const output = render("duplicated-typescript-eslint", {
      clusterFixes: clusterFixesOf("duplicated-typescript-eslint"),
    });
    expect(lastLine(output)).toEndWith("Run `bun-dedupe` to apply.");
  });
});
