import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTempProjects } from "../helpers/tempProjects.ts";

// The bins run from `src` under the test runtime; the `bin` field points at the
// built copy in `dist/bin`, which the end-to-end suite covers.
const binPath = fileURLToPath(new URL("./bun-dedupe.ts", import.meta.url));

const fixtureDir = (name: string): string =>
  fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));

const projects = createTempProjects("bun-dedupe-bin-");

afterEach(projects.cleanup);

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

// a home of its own, so a global ~/.bunfig.toml cannot freeze the lockfile
const runBin = (
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Run => {
  const { XDG_CONFIG_HOME: _xdg, ...inherited } = process.env;
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...inherited, HOME: projects.create(), ...env },
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
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
  readFileSync(join(dir, "bun.lock"), "utf8");

const freeze = (dir: string): void => {
  writeFileSync(join(dir, "bunfig.toml"), "[install]\nfrozenLockfile = true\n");
};

const notice =
  "bun installs use a frozen lockfile here (install.frozenLockfile in bunfig.toml)";

describe("bun-dedupe", () => {
  it("applies on CI when nothing freezes the lockfile", () => {
    const dir = project("duplicated-printable-shell-command");

    const result = runBin(dir, ["--no-clusters"], { CI: "true" });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(notice);
    expect(result.stdout).toContain("bun.lock updated");
  });

  describe("where bunfig.toml freezes the lockfile", () => {
    it("runs as --check: says so, writes nothing, exits 1 when something would change", () => {
      const dir = project("duplicated-printable-shell-command");
      freeze(dir);
      const before = lockOf(dir);

      const result = runBin(dir, ["--no-clusters"]);

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(`${notice}: running as --check`);
      expect(result.stdout).toContain("--immutable-dry-run");
      expect(result.stdout).toContain("bun.lock would be rewritten");
      expect(lockOf(dir)).toBe(before);
    });

    it("runs as --dry-run with --immutable-dry-run, still saying so", () => {
      const dir = project("duplicated-printable-shell-command");
      freeze(dir);
      const before = lockOf(dir);

      const result = runBin(dir, ["--no-clusters", "--immutable-dry-run"]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`${notice}: running as --dry-run`);
      expect(lockOf(dir)).toBe(before);
    });
  });

  it("skips a run started by an install another dedupe run is driving", () => {
    const dir = project("duplicated-printable-shell-command");
    const before = lockOf(dir);

    const result = runBin(dir, ["--no-clusters"], { PM_DEDUP_NESTED_RUN: "1" });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe(
      "bun-dedupe: skipped, started by an install another dedupe run is driving",
    );
    expect(lockOf(dir)).toBe(before);
  });
});
