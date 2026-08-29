import { describe, expect, it } from "bun:test";
import { buildIdentifiedFixesMap } from "pm-utils";
import { displayMany } from "./displayMany.ts";
import type { DisplayManyOptions } from "./displayMany.ts";
import { filterDuplicatesYarnPackagesMap } from "./helpers/buildYarnPackagesMap.ts";
import { collectYarnDependents } from "./helpers/collectYarnDependents.ts";
import { loadFixture } from "./helpers/fixtures.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";

// The report layout is covered in pm-utils (`renderDuplicatesReport`); these
// only check that the yarn.lock model is mapped onto it correctly.
const render = (
  scenario: string,
  overrides: Partial<DisplayManyOptions> = {},
): string => {
  const { packages, packagesMap, workspaces } = loadFixture(scenario);
  const duplicates = filterDuplicatesYarnPackagesMap(packagesMap);
  const dependents = collectYarnDependents({
    packages,
    workspaces,
    onlyPackageNames: Object.keys(duplicates),
  });

  let buffer = "";
  displayMany({
    title: "duplicates",
    duplicatesPackagesMap: duplicates,
    dependents,
    totalDependencies: Object.keys(packagesMap).length,
    identifiedFixesMap: buildIdentifiedFixesMap(duplicates, dependents),
    details: true,
    color: false,
    log: (message = "") => {
      buffer += `${message}\n`;
    },
    ...overrides,
  });
  return buffer;
};

describe("displayMany", () => {
  it("lists each version of a duplicated package, highest first", () => {
    const output = render("duplicated-printable-shell-command");

    expect(output).toContain("printable-shell-command — 2 versions");
    expect(output.indexOf("\n  5.0.8")).toBeLessThan(
      output.indexOf("\n  5.0.7"),
    );
  });

  it("names each requester and the range it declares", () => {
    const output = render("duplicated-printable-shell-command");

    expect(output).toContain("package.json in dependencies");
    expect(output).toContain("uses-psc@npm:1.0.0");
    expect(output).toContain("^5.0.8");
  });

  // the range alone does not say which declaration it comes from when the
  // requester reaches the package through a key of another name
  it("says when a range comes from an aliased declaration", () => {
    expect(render("mergeable-alias")).toContain('(as "psc")');
  });

  // a peer requester constrains the version without holding a copy of its own,
  // so the range has to be attributable to the block it comes from
  it("says when a range comes from a peerDependencies declaration", () => {
    const output = render("peer-range-constrains-merge");

    expect(output).toMatch(
      /uses-peer@npm:1\.0\.0 +requires "\^1\.0\.0" \(peer\)/u,
    );
    // a real dependency edge onto the same package stays unmarked
    expect(output).toMatch(/holder@npm:2\.0\.0 +requires "\*"\n/u);
  });

  // the version is enough: the package name is the block it sits under
  it("shows the merge as versions, not resolutions", () => {
    const output = render("duplicated-printable-shell-command");

    expect(output).toContain("  5.0.7  can be deduped to 5.0.8 (upgrade)");
  });

  it("names a downgrade as one", () => {
    expect(render("exact-pin-forces-downgrade")).toContain("down");
  });

  it("renders the lockstep clusters it is given", () => {
    const { packages, packagesMap, workspaces } = loadFixture(
      "duplicated-typescript-eslint",
    );
    const output = render("duplicated-typescript-eslint", {
      clusterFixes: identifyClusterFixes(packagesMap, packages, workspaces),
    });

    expect(output).toContain("@typescript-eslint");
    expect(output).toContain("8.43.0");
  });

  it("reports a lockfile with no duplicate", () => {
    expect(render("simple")).toContain("0");
  });
});
