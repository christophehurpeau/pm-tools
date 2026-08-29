import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTempProjects } from "../helpers/tempProjects.js";
// The bins run straight from `src`, which is what the `bin` field points at.
const binPath = (name) => fileURLToPath(new URL(`./${name}.ts`, import.meta.url));
const fixtureDir = (name) => fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));
const projects = createTempProjects("bun-dedup-bin-");
afterEach(projects.cleanup);
const runBin = (name, cwd, args) => {
    const result = spawnSync(process.execPath, [binPath(name), ...args], {
        cwd,
        encoding: "utf8",
        timeout: 60_000,
    });
    if (result.error)
        throw result.error;
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    };
};
const project = (fixture) => {
    const dir = projects.create();
    cpSync(fixtureDir(fixture), dir, { recursive: true });
    return dir;
};
// A spawned bin reads its own cwd back resolved — the temp root is reached
// through a symlink on macOS — so the paths it prints are the physical ones.
const lockNotice = (dir) => `using ${join(realpathSync(dir), "bun.lock")}`;
describe("bun-why-duplicate", () => {
    describe("run from a subdirectory", () => {
        it("reports on the project the lockfile is in", () => {
            const dir = project("duplicated-printable-shell-command");
            const nested = join(dir, "packages", "app", "src");
            mkdirSync(nested, { recursive: true });
            const fromRoot = runBin("bun-why-duplicate", dir, ["--details"]);
            const fromNested = runBin("bun-why-duplicate", nested, ["--details"]);
            expect(fromNested.status).toBe(0);
            expect(fromNested.stdout).toBe(fromRoot.stdout);
            expect(fromNested.stdout).toContain("printable-shell-command");
            expect(fromNested.stderr.trim()).toBe(lockNotice(dir));
            expect(fromRoot.stderr).toBe("");
        });
        it("names the lockfile it could not find and exits 1", () => {
            const dir = projects.create();
            const result = runBin("bun-why-duplicate", dir, []);
            expect(result.status).toBe(1);
            expect(result.stderr.trim()).toBe(`No bun.lock found in ${realpathSync(dir)} or any parent directory`);
        });
    });
});
//# sourceMappingURL=bun-why-duplicate.test.js.map