import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureDir } from "../helpers/fixtures.js";
import { createTempProjects } from "../helpers/tempProjects.js";
// The bins run straight from `src`, which is what the `bin` field points at.
const binPath = (name) => fileURLToPath(new URL(`./${name}.ts`, import.meta.url));
const projects = createTempProjects("yarn-berry-deduplicate-bin-");
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
        output: `${result.stdout}\n${result.stderr}`,
        stdout: result.stdout,
        stderr: result.stderr,
    };
};
const project = (fixture) => {
    const dir = projects.create();
    cpSync(fixtureDir(fixture), dir, { recursive: true });
    return dir;
};
const lockOf = (dir) => readFileSync(join(dir, "yarn.lock"), "utf8");
// A spawned bin reads its own cwd back resolved — the temp root is reached
// through a symlink on macOS — so the paths it prints are the physical ones.
const lockNotice = (dir) => `using ${join(realpathSync(dir), "yarn.lock")}`;
describe("yarn-berry-deduplicate", () => {
    it("rewrites the lockfile and says so", () => {
        const dir = project("duplicated-printable-shell-command");
        const result = runBin("yarn-berry-deduplicate", dir, ["--no-clusters"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("Deduped 1 package, 1 copy merged:");
        expect(result.output).toContain("printable-shell-command: 2 versions (5.0.7, 5.0.8) -> 1 version (5.0.8)");
        expect(result.output).toContain("yarn.lock updated");
        expect(lockOf(dir)).toContain('"printable-shell-command@npm:^5.0.7, printable-shell-command@npm:^5.0.8":');
    });
    it("says when there is nothing safe to dedupe", () => {
        const dir = project("simple");
        const result = runBin("yarn-berry-deduplicate", dir, ["--no-clusters"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("Nothing safe to dedupe identified");
    });
    describe("--dry-run", () => {
        it("prints the plan and writes nothing", () => {
            const dir = project("duplicated-printable-shell-command");
            const before = lockOf(dir);
            const result = runBin("yarn-berry-deduplicate", dir, [
                "--dry-run",
                "--no-clusters",
            ]);
            expect(result.status).toBe(0);
            expect(result.output).toContain("yarn.lock would be rewritten");
            expect(lockOf(dir)).toBe(before);
        });
    });
    describe("--check", () => {
        it("exits 1 when something would change, writing nothing", () => {
            const dir = project("duplicated-printable-shell-command");
            const before = lockOf(dir);
            const result = runBin("yarn-berry-deduplicate", dir, [
                "--check",
                "--no-clusters",
            ]);
            expect(result.status).toBe(1);
            expect(lockOf(dir)).toBe(before);
        });
        it("exits 0 when nothing would change", () => {
            const dir = project("simple");
            expect(runBin("yarn-berry-deduplicate", dir, ["--check", "--no-clusters"])
                .status).toBe(0);
        });
    });
    describe("package filters", () => {
        it("leaves a package the filter does not select alone", () => {
            const dir = project("workspaces");
            const before = lockOf(dir);
            const result = runBin("yarn-berry-deduplicate", dir, [
                "--no-clusters",
                "--packages",
                "lodash",
            ]);
            expect(result.status).toBe(0);
            expect(lockOf(dir)).toBe(before);
        });
        it("moves a package the filter selects", () => {
            const dir = project("workspaces");
            const result = runBin("yarn-berry-deduplicate", dir, [
                "--no-clusters",
                "--packages",
                "semver",
            ]);
            expect(result.status).toBe(0);
            expect(result.output).toContain("yarn.lock updated");
        });
    });
    describe("run from a subdirectory", () => {
        it("rewrites the lockfile of the project it walked up to", () => {
            const dir = project("duplicated-printable-shell-command");
            const nested = join(dir, "packages", "app", "src");
            mkdirSync(nested, { recursive: true });
            const result = runBin("yarn-berry-deduplicate", nested, [
                "--no-clusters",
            ]);
            expect(result.status).toBe(0);
            expect(result.stderr.trim()).toBe(lockNotice(dir));
            expect(lockOf(dir)).toContain('"printable-shell-command@npm:^5.0.7, printable-shell-command@npm:^5.0.8":');
        });
        it("names the lockfile it could not find and exits 1", () => {
            const dir = projects.create();
            const result = runBin("yarn-berry-deduplicate", dir, ["--no-clusters"]);
            expect(result.status).toBe(1);
            expect(result.stderr.trim()).toBe(`No yarn.lock found in ${realpathSync(dir)} or any parent directory`);
        });
    });
    it("prints usage for --help and exits 0", () => {
        const dir = project("simple");
        const result = runBin("yarn-berry-deduplicate", dir, ["--help"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("Usage: yarn-berry-deduplicate");
        expect(result.output).toContain("--check");
    });
    it("rejects an unknown flag", () => {
        const dir = project("simple");
        const result = runBin("yarn-berry-deduplicate", dir, ["--strategy=fewer"]);
        expect(result.status).toBe(1);
    });
});
describe("yarn-berry-why-duplicate", () => {
    it("lists one line per duplicated package", () => {
        const dir = project("duplicated-printable-shell-command");
        const result = runBin("yarn-berry-why-duplicate", dir, []);
        expect(result.status).toBe(0);
        expect(result.output).toContain("- printable-shell-command  resolved to 2 versions (5.0.8, 5.0.7)");
        expect(result.output).not.toContain("uses-psc@npm:1.0.0");
    });
    it("names every dependent with --details", () => {
        const dir = project("duplicated-printable-shell-command");
        const result = runBin("yarn-berry-why-duplicate", dir, ["--details"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("printable-shell-command — 2 versions");
        expect(result.output).toContain("uses-psc@npm:1.0.0");
    });
    it("explains one package given as a positional", () => {
        const dir = project("workspaces");
        const result = runBin("yarn-berry-why-duplicate", dir, ["semver"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("semver");
        expect(result.output).not.toContain("lodash");
    });
    it("reports from a workspace, on the project the lockfile is in", () => {
        const dir = project("workspaces");
        const fromRoot = runBin("yarn-berry-why-duplicate", dir, ["--details"]);
        const fromWorkspace = runBin("yarn-berry-why-duplicate", join(dir, "packages", "app"), ["--details"]);
        expect(fromWorkspace.status).toBe(0);
        expect(fromWorkspace.stdout).toBe(fromRoot.stdout);
        expect(fromWorkspace.stderr.trim()).toBe(lockNotice(dir));
        expect(fromRoot.stderr).toBe("");
    });
    it("shows a lockstep family whole", () => {
        const dir = project("duplicated-typescript-eslint");
        const result = runBin("yarn-berry-why-duplicate", dir, ["--details"]);
        expect(result.status).toBe(0);
        expect(result.output).toContain("Lockstep clusters:");
        expect(result.output).toContain("@typescript-eslint/eslint-plugin");
    });
});
//# sourceMappingURL=yarn-berry-deduplicate.test.js.map