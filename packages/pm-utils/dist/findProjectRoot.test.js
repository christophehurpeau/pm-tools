import { afterEach, describe, it } from "bun:test";
import { strictEqual } from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRoot } from "./findProjectRoot.js";
const lockfileName = "pm-tools.lock";
const dirs = [];
afterEach(() => {
    for (const dir of dirs.splice(0))
        rmSync(dir, { recursive: true, force: true });
});
const tempRoot = () => {
    const dir = mkdtempSync(join(tmpdir(), `find-project-root-${process.pid}-`));
    dirs.push(dir);
    return dir;
};
const makeDir = (root, relativePath) => {
    const dir = join(root, relativePath);
    mkdirSync(dir, { recursive: true });
    return dir;
};
const makeLockfile = (dir) => {
    writeFileSync(join(dir, lockfileName), "");
};
describe("findProjectRoot", () => {
    it("finds the lockfile in cwd", () => {
        const root = tempRoot();
        makeLockfile(root);
        strictEqual(findProjectRoot({ lockfileName, cwd: root }), root);
    });
    it("walks up to an ancestor holding the lockfile", () => {
        const root = tempRoot();
        makeLockfile(root);
        const nested = makeDir(root, join("packages", "app", "src"));
        strictEqual(findProjectRoot({ lockfileName, cwd: nested }), root);
    });
    it("stops at the nearest one when two ancestors hold a lockfile", () => {
        const root = tempRoot();
        makeLockfile(root);
        const nestedProject = makeDir(root, "examples/embedded");
        makeLockfile(nestedProject);
        const nested = makeDir(nestedProject, "src");
        strictEqual(findProjectRoot({ lockfileName, cwd: nested }), nestedProject);
    });
    it("returns null when no ancestor up to the filesystem root has one", () => {
        const root = tempRoot();
        const nested = makeDir(root, "packages/app");
        strictEqual(findProjectRoot({ lockfileName, cwd: nested }), null);
    });
});
//# sourceMappingURL=findProjectRoot.test.js.map