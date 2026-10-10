import { describe, expect, it } from "bun:test";
import { heldOverrides, outstandingOverrides } from "./clusterOverrides.ts";
import type { PlannedOverride } from "./planClusterApply.ts";

const converge = (packageName: string, version: string): PlannedOverride => ({
  packageName,
  version,
  reason: "converge",
});

const reuse = (packageName: string, version: string): PlannedOverride => ({
  packageName,
  version,
  reason: "reuse",
});

const names = (overrides: PlannedOverride[]): string[] =>
  overrides.map((override) => override.packageName);

describe("outstandingOverrides", () => {
  const state = {
    duplicates: new Set(["dup@1.0.0", "dup@2.0.0"]),
    versions: new Map([
      ["dup", ["1.0.0", "2.0.0"]],
      ["parent", ["8.65.0"]],
      ["settled", ["8.63.0"]],
      ["anchored", ["1.30.1", "1.33.0"]],
      ["repointed", ["1.30.1", "1.33.0"]],
    ]),
    reuses: new Set(["plugin>anchored@1.30.1"]),
  };

  it("keeps a converging member nothing duplicates while it sits elsewhere", () => {
    expect(
      names(outstandingOverrides([converge("parent", "8.63.0")], state)),
    ).toEqual(["parent"]);
  });

  it("drops a converging member already on the version", () => {
    expect(
      outstandingOverrides([converge("settled", "8.63.0")], state),
    ).toEqual([]);
  });

  it("keeps an override whose package is duplicated", () => {
    expect(
      names(outstandingOverrides([converge("dup", "1.0.0")], state)),
    ).toEqual(["dup"]);
  });

  it("keeps a reuse override whose edge is still open", () => {
    expect(
      names(outstandingOverrides([reuse("anchored", "1.30.1")], state)),
    ).toEqual(["anchored"]);
  });

  it("drops a reuse override whose edge took, even with other versions left", () => {
    expect(outstandingOverrides([reuse("repointed", "1.30.1")], state)).toEqual(
      [],
    );
  });
});

describe("heldOverrides", () => {
  const start = { duplicates: new Set(["dup@1.0.0", "dup@2.0.0"]) };
  const held = (
    overrides: PlannedOverride[],
    end: { duplicates: string[]; versions: [string, string[]][] },
    reuseHeld = (): boolean => true,
  ): string[] =>
    names(
      heldOverrides(overrides, {
        start,
        end: {
          duplicates: new Set(end.duplicates),
          versions: new Map(end.versions),
        },
        reuseHeld,
      }),
    );

  it("holds a duplicated package that collapsed onto another version", () => {
    expect(
      held([converge("dup", "1.0.0")], {
        duplicates: [],
        versions: [["dup", ["2.0.0"]]],
      }),
    ).toEqual(["dup"]);
  });

  it("does not hold a package still duplicated", () => {
    expect(
      held([converge("dup", "1.0.0")], {
        duplicates: ["dup@1.0.0", "dup@2.0.0"],
        versions: [["dup", ["1.0.0", "2.0.0"]]],
      }),
    ).toEqual([]);
  });

  it("does not hold a member that never moved", () => {
    expect(
      held([converge("parent", "8.63.0")], {
        duplicates: [],
        versions: [["parent", ["8.65.0"]]],
      }),
    ).toEqual([]);
  });

  it("holds a member now on the version alone", () => {
    expect(
      held([converge("parent", "8.63.0")], {
        duplicates: [],
        versions: [["parent", ["8.63.0"]]],
      }),
    ).toEqual(["parent"]);
  });

  it("asks the lockfile about a reuse override", () => {
    const end = { duplicates: [], versions: [] };
    expect(held([reuse("anchored", "1.30.1")], end, () => false)).toEqual([]);
    expect(held([reuse("anchored", "1.30.1")], end, () => true)).toEqual([
      "anchored",
    ]);
  });
});
