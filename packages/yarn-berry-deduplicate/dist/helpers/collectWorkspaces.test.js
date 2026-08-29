import { describe, expect, it } from "bun:test";
import { collectWorkspaces } from "./collectWorkspaces.js";
import { loadFixture } from "./fixtures.js";
import { parseYarnLockPackages } from "./parseYarnLockPackages.js";
import { parseYarnLock } from "./syml.js";
describe("collectWorkspaces", () => {
    it("reads the root workspace as the project directory itself", () => {
        const { workspaces } = loadFixture("simple");
        expect(workspaces).toEqual([
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
        const app = workspaces.find((workspace) => workspace.path === "packages/app");
        expect(app?.dependencies).toEqual([
            { key: "lodash", value: "^4.17.0", depType: "dependencies" },
            { key: "semver", value: "^7.6.0", depType: "devDependencies" },
        ]);
    });
    it("falls back to the lockfile when a manifest cannot be read", () => {
        const packages = parseYarnLockPackages(parseYarnLock(`__metadata:
  version: 8

"app@workspace:packages/app":
  version: 0.0.0-use.local
  resolution: "app@workspace:packages/app"
  dependencies:
    lodash: "npm:^4.17.0"
`));
        expect(collectWorkspaces(packages, () => undefined)).toEqual([
            {
                path: "packages/app",
                name: "app",
                dependencies: [
                    { key: "lodash", value: "npm:^4.17.0", depType: "dependencies" },
                ],
            },
        ]);
    });
    it("lists a workspace once however many descriptors reach it", () => {
        const packages = parseYarnLockPackages(parseYarnLock(`__metadata:
  version: 8

"app@workspace:*, app@workspace:packages/app":
  version: 0.0.0-use.local
  resolution: "app@workspace:packages/app"
`));
        expect(collectWorkspaces(packages, () => undefined)).toHaveLength(1);
    });
});
//# sourceMappingURL=collectWorkspaces.test.js.map