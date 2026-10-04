import { describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import {
  buildVersionsSnapshot,
  countDuplicatedPackages,
  diffVersionsSnapshots,
} from "./versionsSnapshot.ts";
import type { SnapshotPackage, VersionsSnapshot } from "./versionsSnapshot.ts";

const npm = (name: string, version: string): SnapshotPackage => ({
  type: "npm",
  name,
  version,
  resolution: `${name}@${version}`,
});

const snapshot = (entries: Record<string, string[]>): VersionsSnapshot =>
  new Map(Object.entries(entries));

describe("buildVersionsSnapshot", () => {
  it("groups versions per package, sorted by semver", () => {
    deepStrictEqual(
      [
        ...buildVersionsSnapshot([
          npm("semver", "7.10.0"),
          npm("semver", "7.9.0"),
          npm("lodash", "4.17.21"),
        ]),
      ],
      [
        ["semver", ["7.9.0", "7.10.0"]],
        ["lodash", ["4.17.21"]],
      ],
    );
  });

  it("counts one version per resolution, whatever it is installed at", () => {
    deepStrictEqual(
      buildVersionsSnapshot([npm("semver", "7.9.0"), npm("semver", "7.9.0")]),
      snapshot({ semver: ["7.9.0"] }),
    );
  });

  it("identifies a non-npm package by its resolution", () => {
    deepStrictEqual(
      buildVersionsSnapshot([
        { type: "git", name: "psc", resolution: "psc@git:abcdef" },
      ]),
      snapshot({ psc: ["psc@git:abcdef"] }),
    );
  });
});

describe("diffVersionsSnapshots", () => {
  it("keeps both sides whole, so the collapse reads as one", () => {
    deepStrictEqual(
      diffVersionsSnapshots(
        snapshot({ "range-parser": ["1.2.1", "1.3.0"] }),
        snapshot({ "range-parser": ["1.2.1"] }),
      ),
      [
        {
          packageName: "range-parser",
          before: ["1.2.1", "1.3.0"],
          after: ["1.2.1"],
        },
      ],
    );
  });

  it("reports a package only partly collapsed with what is left", () => {
    deepStrictEqual(
      diffVersionsSnapshots(
        snapshot({ semver: ["7.5.4", "7.6.0", "7.7.1"] }),
        snapshot({ semver: ["7.6.0", "7.7.1"] }),
      ),
      [
        {
          packageName: "semver",
          before: ["7.5.4", "7.6.0", "7.7.1"],
          after: ["7.6.0", "7.7.1"],
        },
      ],
    );
  });

  it("says nothing of a package whose versions did not move", () => {
    deepStrictEqual(
      diffVersionsSnapshots(
        snapshot({ semver: ["7.7.1"] }),
        snapshot({ semver: ["7.7.1"], lodash: ["4.17.21"] }),
      ),
      [],
    );
  });

  // the cluster pass that made the edit reports it; no copy went away, so it is
  // not a dedupe
  it("says nothing of a version that moved without a copy going away", () => {
    deepStrictEqual(
      diffVersionsSnapshots(
        snapshot({ metro: ["0.84.5"] }),
        snapshot({ metro: ["0.87.0"] }),
      ),
      [],
    );
  });

  // the rewritten copy drops the private subtrees of the versions it replaced,
  // and the next install resolves them again: gone from the lockfile is not
  // deduplicated
  it("says nothing of a package that left the lockfile entirely", () => {
    deepStrictEqual(
      diffVersionsSnapshots(
        snapshot({ "metro-config": ["0.84.5"] }),
        snapshot({}),
      ),
      [],
    );
  });

  it("sorts the entries by package name", () => {
    deepStrictEqual(
      diffVersionsSnapshots(
        snapshot({ semver: ["1.0.0", "2.0.0"], lodash: ["3.0.0", "4.0.0"] }),
        snapshot({ semver: ["2.0.0"], lodash: ["4.0.0"] }),
      ).map((entry) => entry.packageName),
      ["lodash", "semver"],
    );
  });
});

describe("countDuplicatedPackages", () => {
  it("counts the packages resolved more than once", () => {
    strictEqual(
      countDuplicatedPackages(
        snapshot({
          semver: ["7.5.4", "7.7.1"],
          lodash: ["4.17.21"],
          react: ["18.0.0", "19.0.0"],
        }),
      ),
      2,
    );
  });
});
