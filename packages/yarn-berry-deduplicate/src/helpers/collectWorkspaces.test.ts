import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { collectWorkspaces } from "./collectWorkspaces.ts";
import { loadFixture } from "./fixtures.ts";
import { parseYarnLockPackages } from "./parseYarnLockPackages.ts";
import { parseYarnLock } from "./syml.ts";

describe("collectWorkspaces", () => {
  it("reads the root workspace as the project directory itself", () => {
    const { workspaces } = loadFixture("simple");

    deepStrictEqual(workspaces, [
      {
        path: "",
        name: "root-workspace",
        dependencies: [
          { key: "lodash", value: "^4.17.0", depType: "dependencies" },
        ],
      },
    ]);
  });

  // the lockfile folds a workspace's dependencies and devDependencies into one
  // map, so the block a range is declared in is only in the manifest
  it("recovers the dependency block from the manifest", () => {
    const { workspaces } = loadFixture("workspaces");
    const app = workspaces.find(
      (workspace) => workspace.path === "packages/app",
    );

    deepStrictEqual(app?.dependencies, [
      { key: "lodash", value: "^4.17.0", depType: "dependencies" },
      { key: "semver", value: "^7.6.0", depType: "devDependencies" },
    ]);
  });

  it("falls back to the lockfile when a manifest cannot be read", () => {
    const packages = parseYarnLockPackages(
      parseYarnLock(`__metadata:
  version: 8

"app@workspace:packages/app":
  version: 0.0.0-use.local
  resolution: "app@workspace:packages/app"
  dependencies:
    lodash: "npm:^4.17.0"
`),
    );

    deepStrictEqual(
      collectWorkspaces(packages, () => undefined),
      [
        {
          path: "packages/app",
          name: "app",
          dependencies: [
            { key: "lodash", value: "npm:^4.17.0", depType: "dependencies" },
          ],
        },
      ],
    );
  });

  it("lists a workspace once however many descriptors reach it", () => {
    const packages = parseYarnLockPackages(
      parseYarnLock(`__metadata:
  version: 8

"app@workspace:*, app@workspace:packages/app":
  version: 0.0.0-use.local
  resolution: "app@workspace:packages/app"
`),
    );

    strictEqual(collectWorkspaces(packages, () => undefined).length, 1);
  });
});
