import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bunLockfileIsFrozen } from "./frozenLockfile.ts";
import { createTempProjects } from "./tempProjects.ts";

const projects = createTempProjects("bun-dedup-frozen-");

afterEach(projects.cleanup);

const bunfig = (frozenLockfile: boolean): string =>
  `[install]\nfrozenLockfile = ${String(frozenLockfile)}\n`;

interface Layout {
  project?: string;
  home?: string;
  xdg?: string;
}

const setup = ({
  project,
  home,
  xdg,
}: Layout): { projectDir: string; homeDir: string; xdgDir: string } => {
  const root = projects.create();
  const dirs = {
    projectDir: join(root, "project"),
    homeDir: join(root, "home"),
    xdgDir: join(root, "xdg"),
  };
  for (const dir of Object.values(dirs)) mkdirSync(dir);
  if (project !== undefined) {
    writeFileSync(join(dirs.projectDir, "bunfig.toml"), project);
  }
  if (home !== undefined) {
    writeFileSync(join(dirs.homeDir, ".bunfig.toml"), home);
  }
  if (xdg !== undefined) writeFileSync(join(dirs.xdgDir, ".bunfig.toml"), xdg);
  return dirs;
};

describe("bunLockfileIsFrozen", () => {
  it("is false with no bunfig, CI or not", () => {
    const { projectDir, homeDir } = setup({});
    expect(bunLockfileIsFrozen(projectDir, { HOME: homeDir, CI: "true" })).toBe(
      false,
    );
  });

  it("follows the project's bunfig.toml", () => {
    const { projectDir, homeDir } = setup({ project: bunfig(true) });
    expect(bunLockfileIsFrozen(projectDir, { HOME: homeDir })).toBe(true);
  });

  it("does not read a dotted .bunfig.toml in the project", () => {
    const { projectDir, homeDir } = setup({});
    writeFileSync(join(projectDir, ".bunfig.toml"), bunfig(true));
    expect(bunLockfileIsFrozen(projectDir, { HOME: homeDir })).toBe(false);
  });

  it("falls back to ~/.bunfig.toml", () => {
    const { projectDir, homeDir } = setup({ home: bunfig(true) });
    expect(bunLockfileIsFrozen(projectDir, { HOME: homeDir })).toBe(true);
  });

  it("lets the project override the global setting", () => {
    const { projectDir, homeDir } = setup({
      project: bunfig(false),
      home: bunfig(true),
    });
    expect(bunLockfileIsFrozen(projectDir, { HOME: homeDir })).toBe(false);
  });

  it("reads $XDG_CONFIG_HOME/.bunfig.toml instead of ~/.bunfig.toml when set", () => {
    const { projectDir, homeDir, xdgDir } = setup({ home: bunfig(true) });
    expect(
      bunLockfileIsFrozen(projectDir, {
        HOME: homeDir,
        XDG_CONFIG_HOME: xdgDir,
      }),
    ).toBe(false);

    writeFileSync(join(xdgDir, ".bunfig.toml"), bunfig(true));
    expect(
      bunLockfileIsFrozen(projectDir, {
        HOME: homeDir,
        XDG_CONFIG_HOME: xdgDir,
      }),
    ).toBe(true);
  });

  it("ignores a bunfig that does not parse", () => {
    const { projectDir, homeDir } = setup({ project: "[install\n" });
    expect(bunLockfileIsFrozen(projectDir, { HOME: homeDir })).toBe(false);
  });
});
