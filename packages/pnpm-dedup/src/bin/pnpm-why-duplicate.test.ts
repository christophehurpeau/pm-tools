import { ok, strictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createTempProjects } from "../helpers/tempProjects.ts";

// The bins run from `src` under the test runtime; the `bin` field points at the
// built copy in `dist/bin`, which the end-to-end suite covers.
const binPath = (name: string): string =>
  fileURLToPath(new URL(`./${name}.ts`, import.meta.url));

const fixtureDir = (name: string): string =>
  fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));

const projects = createTempProjects("pnpm-dedup-bin-");

afterEach(projects.cleanup);

interface Run {
  status: number | null;
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
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const project = (fixture: string): string => {
  const dir = projects.create();
  cpSync(fixtureDir(fixture), dir, { recursive: true });
  return dir;
};

// A spawned bin reads its own cwd back resolved — the temp root is reached
// through a symlink on macOS — so the paths it prints are the physical ones.
const lockNotice = (dir: string): string =>
  `using ${join(realpathSync(dir), "pnpm-lock.yaml")}`;

describe("pnpm-why-duplicate", () => {
  describe("run from a subdirectory", () => {
    it("reports on the project the lockfile is in", () => {
      const dir = project("duplicated-printable-shell-command");
      const nested = join(dir, "packages", "app", "src");
      mkdirSync(nested, { recursive: true });

      const fromRoot = runBin("pnpm-why-duplicate", dir, ["--details"]);
      const fromNested = runBin("pnpm-why-duplicate", nested, ["--details"]);

      strictEqual(fromNested.status, 0);
      strictEqual(fromNested.stdout, fromRoot.stdout);
      ok(fromNested.stdout.includes("printable-shell-command"));
      strictEqual(fromNested.stderr.trim(), lockNotice(dir));
      strictEqual(fromRoot.stderr, "");
    });

    it("names the lockfile it could not find and exits 1", () => {
      const dir = projects.create();

      const result = runBin("pnpm-why-duplicate", dir, []);

      strictEqual(result.status, 1);
      strictEqual(
        result.stderr.trim(),
        `No pnpm-lock.yaml found in ${realpathSync(dir)} or any parent directory`,
      );
    });
  });
});
