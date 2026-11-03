import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { pnpmLockfileIsFrozen } from "./frozenLockfile.ts";
import type { PnpmRunner } from "./runPnpm.ts";

// `pnpm config get <key> --json` as pnpm 12 answers it: `null` when unset
const configuredAs =
  (config: Record<string, unknown>): PnpmRunner =>
  (args) => ({
    status: 0,
    output: `${JSON.stringify(config[args[2]!] ?? null)}\n`,
  });

describe("pnpmLockfileIsFrozen", () => {
  it("asks pnpm in the project", () => {
    const calls: unknown[] = [];
    pnpmLockfileIsFrozen({
      projectDir: "/project",
      isCI: false,
      run: (args, options) => {
        calls.push({ args, options });
        return { status: 0, output: "true\n" };
      },
    });

    deepStrictEqual(calls, [
      {
        args: ["config", "get", "frozen-lockfile", "--json"],
        options: { cwd: "/project", stdio: "pipe" },
      },
    ]);
  });

  it("follows an explicit frozen-lockfile, on CI or not", () => {
    for (const isCI of [true, false]) {
      for (const frozen of [true, false]) {
        strictEqual(
          pnpmLockfileIsFrozen({
            projectDir: "/p",
            isCI,
            run: configuredAs({ "frozen-lockfile": frozen }),
          }),
          frozen,
        );
      }
    }
  });

  it("is frozen on CI when nothing is set", () => {
    strictEqual(
      pnpmLockfileIsFrozen({
        projectDir: "/p",
        isCI: true,
        run: configuredAs({}),
      }),
      true,
    );
  });

  it("is frozen on CI with prefer-frozen-lockfile true", () => {
    strictEqual(
      pnpmLockfileIsFrozen({
        projectDir: "/p",
        isCI: true,
        run: configuredAs({ "prefer-frozen-lockfile": true }),
      }),
      true,
    );
  });

  it("is not frozen on CI with prefer-frozen-lockfile false", () => {
    strictEqual(
      pnpmLockfileIsFrozen({
        projectDir: "/p",
        isCI: true,
        run: configuredAs({ "prefer-frozen-lockfile": false }),
      }),
      false,
    );
  });

  it("is not frozen off CI when nothing is set", () => {
    strictEqual(
      pnpmLockfileIsFrozen({
        projectDir: "/p",
        isCI: false,
        run: configuredAs({}),
      }),
      false,
    );
  });

  it("is false when pnpm cannot be spawned", () => {
    strictEqual(
      pnpmLockfileIsFrozen({
        projectDir: "/p",
        isCI: true,
        run: () => {
          throw new Error("spawnSync pnpm ENOENT");
        },
      }),
      false,
    );
  });
});
