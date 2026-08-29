import { describe, expect, it } from "bun:test";
import { ok } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import type { ClusterFix } from "pm-utils";
import { displayMany } from "./displayMany.ts";
import {
  buildPnpmPackagesMap,
  filterDuplicatesPnpmPackagesMap,
} from "./helpers/buildPnpmPackagesMap.ts";
import { collectDependentRanges } from "./helpers/collectDependentRanges.ts";
import { parsePnpmLockPackages } from "./helpers/parsePnpmLockPackages.ts";
import type { ManifestReader } from "./helpers/readInstalledManifest.ts";
import { createManifestReader } from "./helpers/readInstalledManifest.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import { readPnpmLock } from "./readPnpmLock.ts";

const fixturesBase = (rel: string) =>
  fileURLToPath(new URL(rel, import.meta.url));

// The report layout is covered in pm-utils (`renderDuplicatesReport`); these
// only check that the pnpm lockfile model is mapped onto it correctly.
const renderDuplicates = (
  scenario: string,
  clusterFixes?: ClusterFix[],
  readManifest: ManifestReader = () => undefined,
): string => {
  const lock = readPnpmLock(
    fixturesBase(`../test/fixtures/${scenario}/pnpm-lock.yaml`),
  );
  const packagesMap = buildPnpmPackagesMap(parsePnpmLockPackages(lock));
  const duplicates = filterDuplicatesPnpmPackagesMap(packagesMap);

  let buffer = "";
  displayMany({
    title: "duplicates",
    duplicatesPackagesMap: duplicates,
    dependents: collectDependentRanges(
      lock,
      new Set(Object.keys(duplicates)),
      readManifest,
    ),
    totalDependencies: Object.keys(packagesMap).length,
    clusterFixes,
    details: true,
    color: false,
    log: (message = "") => {
      buffer += `${message}\n`;
    },
  });
  return buffer;
};

// `exact-pin-forces-downgrade` commits its virtual store, so the report runs on
// the real declared ranges: an exact 3.0.3 against expo-camera's `^3.0.0`.
const downgradeScenario = "exact-pin-forces-downgrade";
const downgradeDir = fixturesBase(`../test/fixtures/${downgradeScenario}`);

const renderDowngrade = (): string => {
  const lock = readPnpmLock(`${downgradeDir}/pnpm-lock.yaml`);
  const readManifest = createManifestReader(downgradeDir);
  return renderDuplicates(
    downgradeScenario,
    identifyClusterFixes(
      lock,
      buildPnpmPackagesMap(parsePnpmLockPackages(lock)),
      readManifest,
    ),
    readManifest,
  );
};

const lastLine = (output: string): string =>
  output.trimEnd().split("\n").at(-1)!;

const clusterFix = (overrides: Partial<ClusterFix> = {}): ClusterFix => ({
  members: ["metro", "metro-config"],
  duplicatedMembers: ["metro", "metro-config"],
  memberVersions: {
    metro: { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
    "metro-config": { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
  },
  target: "0.87.0",
  direction: "up",
  convergentMembers: ["metro", "metro-config"],
  driverMembers: ["metro"],
  excludedMembers: [],
  anchor: null,
  reuseFixes: [],
  floatingMembers: [],
  workspaceChanges: [],
  reResolutionSet: ["metro"],
  externalConstraints: [],
  needsRoundTrip: true,
  applicable: true,
  ...overrides,
});

const singletonFix = (overrides: Partial<ClusterFix> = {}): ClusterFix => ({
  ...clusterFix(),
  members: ["@babel/code-frame"],
  duplicatedMembers: ["@babel/code-frame"],
  memberVersions: {
    "@babel/code-frame": { versions: ["7.26.2", "7.29.7"], nonNpmCount: 0 },
  },
  target: "7.29.7",
  direction: "up",
  convergentMembers: ["@babel/code-frame"],
  driverMembers: ["@babel/code-frame"],
  reResolutionSet: [],
  needsRoundTrip: false,
  ...overrides,
});

describe("displayMany", () => {
  it("groups every dependent under the version it resolved to", () => {
    const output = renderDuplicates("duplicated-babel-frame");
    ok(output.startsWith("Found "));
    ok(output.includes("@babel/code-frame — 2 versions"));
    ok(output.includes('package.json in dependencies  requires "7.26.2"'));
    // pnpm defers the per-package merge to `pnpm dedupe`
    ok(!output.includes("can be deduped"));
  });

  it("renders the printable-shell-command duplicate", () => {
    const output = renderDuplicates("duplicated-printable-shell-command");
    ok(output.includes("printable-shell-command — 2 versions"));
    ok(output.includes("  5.0.7"));
  });

  it("reports no duplicates for a clean lockfile", () => {
    expect(renderDuplicates("simple")).toBe(
      "No duplicates found\n\nFound 1 dependency, 0 duplicates, 0 dedupable.\n",
    );
  });

  it("maps a cluster of one to the versions that would collapse", () => {
    const output = renderDuplicates("duplicated-babel-frame", [singletonFix()]);
    ok(
      output.includes(
        "@babel/code-frame — 2 versions, can be deduped to 7.29.7 (upgrade)",
      ),
    );
    ok(output.includes("  7.26.2  can be deduped to 7.29.7 (upgrade)"));
    // a lone package is no family, so it gets no cluster section
    ok(!output.includes("Lockstep clusters:"));
  });

  it("counts the whole lockfile and names the pnpm command", () => {
    const output = renderDuplicates("duplicated-babel-frame", [singletonFix()]);
    ok(
      lastLine(output).startsWith(
        "Found 39 dependencies, 1 duplicate, at least 1 dedupable (deduping may remove more). Run `pnpm-dedupe`",
      ),
    );
  });

  it("says nothing collapses when the cluster of one is unfixable", () => {
    const output = renderDuplicates("duplicated-babel-frame", [
      singletonFix({
        target: null,
        direction: "none",
        convergentMembers: [],
        driverMembers: [],
        applicable: false,
      }),
    ]);
    ok(!output.includes("can be deduped"));
    ok(lastLine(output).includes("0 dedupable"));
  });

  it("files a declared range under the version it resolved to", () => {
    const output = renderDowngrade();
    ok(
      output.includes(
        '    - expo-camera@57.0.3              requires "^3.0.0"',
      ),
    );
    ok(
      output.includes('    - @yudiel/react-qr-scanner@2.3.1  requires "3.0.3"'),
    );
  });

  it("names the downgrade a converging dependent has to take", () => {
    const output = renderDowngrade();
    ok(output.includes("  3.2.2  can be deduped to 3.0.3 (downgrade)"));
    // zxing-wasm cannot converge: `^2.1.2` against an exact 3.1.3
    ok(lastLine(output).includes("2 duplicates, at least 1 dedupable"));
  });

  it("forwards the cluster fixes", () => {
    const output = renderDuplicates("duplicated-babel-frame", [clusterFix()]);
    ok(output.includes("Lockstep clusters:"));
    ok(
      output.includes(
        "cluster 1 — metro* [2 packages, 2 duplicated, 2 fixable]:",
      ),
    );
    // the family's own members are not in this lockfile's duplicates, so the
    // count — which follows the listed packages — stays at zero
    ok(lastLine(output).includes("0 dedupable"));
  });

  it("renders a cluster from a lockfile with no per-package duplicate", () => {
    const output = renderDuplicates("simple", [clusterFix()]);
    ok(output.startsWith("No duplicates found"));
    ok(output.includes("Lockstep clusters:"));
  });
});
