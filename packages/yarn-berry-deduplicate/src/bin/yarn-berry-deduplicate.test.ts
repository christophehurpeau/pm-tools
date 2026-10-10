import { ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { fixtureDir } from "../helpers/fixtures.ts";
import { createTempProjects } from "../helpers/tempProjects.ts";

// The bins run from `src` under the test runtime; the `bin` field points at the
// built copy in `dist/bin`, which the end-to-end suite covers.
const binPath = (name: string): string =>
  fileURLToPath(new URL(`./${name}.ts`, import.meta.url));

const projects = createTempProjects("yarn-berry-deduplicate-bin-");

afterEach(projects.cleanup);

interface Run {
  status: number | null;
  output: string;
  stdout: string;
  stderr: string;
}

const runBin = (name: string, cwd: string, args: string[]): Run => {
  const result = spawnSync(process.execPath, [binPath(name), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const project = (fixture: string): string => {
  const dir = projects.create();
  cpSync(fixtureDir(fixture), dir, { recursive: true });
  return dir;
};

const lockOf = (dir: string): string =>
  readFileSync(join(dir, "yarn.lock"), "utf8");

// A spawned bin reads its own cwd back resolved — the temp root is reached
// through a symlink on macOS — so the paths it prints are the physical ones.
const lockNotice = (dir: string): string =>
  `using ${join(realpathSync(dir), "yarn.lock")}`;

describe("yarn-berry-deduplicate", () => {
  it("rewrites the lockfile and says so", () => {
    const dir = project("duplicated-printable-shell-command");

    const result = runBin("yarn-berry-deduplicate", dir, ["--no-clusters"]);

    strictEqual(result.status, 0);
    ok(result.output.includes("Deduped 1 package, 1 copy merged:"));
    ok(
      result.output.includes(
        "printable-shell-command: 2 versions (5.0.7, 5.0.8) -> 1 version (5.0.8)",
      ),
    );
    ok(result.output.includes("yarn.lock updated"));
    ok(
      lockOf(dir).includes(
        '"printable-shell-command@npm:^5.0.7, printable-shell-command@npm:^5.0.8":',
      ),
    );
  });

  it("says when there is nothing safe to dedupe", () => {
    const dir = project("simple");

    const result = runBin("yarn-berry-deduplicate", dir, ["--no-clusters"]);

    strictEqual(result.status, 0);
    ok(result.output.includes("Nothing safe to dedupe identified"));
  });

  describe("--dry-run", () => {
    it("prints the plan and writes nothing", () => {
      const dir = project("duplicated-printable-shell-command");
      const before = lockOf(dir);

      const result = runBin("yarn-berry-deduplicate", dir, [
        "--dry-run",
        "--no-clusters",
      ]);

      strictEqual(result.status, 0);
      ok(result.output.includes("yarn.lock would be rewritten"));
      strictEqual(lockOf(dir), before);
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

      strictEqual(result.status, 1);
      strictEqual(lockOf(dir), before);
    });

    it("exits 0 when nothing would change", () => {
      const dir = project("simple");

      strictEqual(
        runBin("yarn-berry-deduplicate", dir, ["--check", "--no-clusters"])
          .status,
        0,
      );
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

      strictEqual(result.status, 0);
      strictEqual(lockOf(dir), before);
    });

    it("moves a package the filter selects", () => {
      const dir = project("workspaces");

      const result = runBin("yarn-berry-deduplicate", dir, [
        "--no-clusters",
        "--packages",
        "semver",
      ]);

      strictEqual(result.status, 0);
      ok(result.output.includes("yarn.lock updated"));
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

      strictEqual(result.status, 0);
      strictEqual(result.stderr.trim(), lockNotice(dir));
      ok(
        lockOf(dir).includes(
          '"printable-shell-command@npm:^5.0.7, printable-shell-command@npm:^5.0.8":',
        ),
      );
    });

    it("names the lockfile it could not find and exits 1", () => {
      const dir = projects.create();

      const result = runBin("yarn-berry-deduplicate", dir, ["--no-clusters"]);

      strictEqual(result.status, 1);
      strictEqual(
        result.stderr.trim(),
        `No yarn.lock found in ${realpathSync(dir)} or any parent directory`,
      );
    });
  });

  it("prints usage for --help and exits 0", () => {
    const dir = project("simple");
    const result = runBin("yarn-berry-deduplicate", dir, ["--help"]);

    strictEqual(result.status, 0);
    ok(result.output.includes("Usage: yarn-berry-deduplicate"));
    ok(result.output.includes("--check"));
  });

  it("rejects an unknown flag", () => {
    const dir = project("simple");
    const result = runBin("yarn-berry-deduplicate", dir, ["--strategy=fewer"]);

    strictEqual(result.status, 1);
  });
});

describe("yarn-berry-why-duplicate", () => {
  it("lists one line per duplicated package", () => {
    const dir = project("duplicated-printable-shell-command");
    const result = runBin("yarn-berry-why-duplicate", dir, []);

    strictEqual(result.status, 0);
    ok(
      result.output.includes(
        "- printable-shell-command  resolved to 2 versions (5.0.8, 5.0.7)",
      ),
    );
    ok(!result.output.includes("uses-psc@npm:1.0.0"));
  });

  it("names every dependent with --details", () => {
    const dir = project("duplicated-printable-shell-command");
    const result = runBin("yarn-berry-why-duplicate", dir, ["--details"]);

    strictEqual(result.status, 0);
    ok(result.output.includes("printable-shell-command — 2 versions"));
    ok(result.output.includes("uses-psc@npm:1.0.0"));
  });

  it("explains one package given as a positional", () => {
    const dir = project("workspaces");
    const result = runBin("yarn-berry-why-duplicate", dir, ["semver"]);

    strictEqual(result.status, 0);
    ok(result.output.includes("semver"));
    ok(!result.output.includes("lodash"));
  });

  it("reports from a workspace, on the project the lockfile is in", () => {
    const dir = project("workspaces");

    const fromRoot = runBin("yarn-berry-why-duplicate", dir, ["--details"]);
    const fromWorkspace = runBin(
      "yarn-berry-why-duplicate",
      join(dir, "packages", "app"),
      ["--details"],
    );

    strictEqual(fromWorkspace.status, 0);
    strictEqual(fromWorkspace.stdout, fromRoot.stdout);
    strictEqual(fromWorkspace.stderr.trim(), lockNotice(dir));
    strictEqual(fromRoot.stderr, "");
  });

  it("shows a lockstep family whole", () => {
    const dir = project("duplicated-typescript-eslint");
    const result = runBin("yarn-berry-why-duplicate", dir, ["--details"]);

    strictEqual(result.status, 0);
    ok(result.output.includes("Lockstep clusters:"));
    ok(result.output.includes("@typescript-eslint/eslint-plugin"));
  });
});
