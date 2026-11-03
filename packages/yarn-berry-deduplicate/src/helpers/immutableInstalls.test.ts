import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { yarnInstallsAreImmutable } from "./immutableInstalls.ts";
import type { YarnRunner } from "./runYarn.ts";

const answering =
  (status: number | null, stdout: string): YarnRunner =>
  () => ({ status, output: `${stdout}\n` });

describe("yarnInstallsAreImmutable", () => {
  it("asks yarn for the setting it resolved, in the project", () => {
    const calls: unknown[] = [];
    yarnInstallsAreImmutable("/project", (args, options) => {
      calls.push({ args, options });
      return { status: 0, output: "false\n" };
    });

    deepStrictEqual(calls, [
      {
        args: ["config", "get", "enableImmutableInstalls", "--json"],
        options: { cwd: "/project", stdio: "pipe" },
      },
    ]);
  });

  it("is true when yarn says so", () => {
    strictEqual(yarnInstallsAreImmutable("/p", answering(0, "true")), true);
  });

  it("is false when yarn says so", () => {
    strictEqual(yarnInstallsAreImmutable("/p", answering(0, "false")), false);
  });

  it("reads stdout only, not what corepack prints on stderr", () => {
    strictEqual(
      yarnInstallsAreImmutable("/p", () => ({
        status: 0,
        output: "false\n! Corepack is about to download yarn\ntrue",
      })),
      false,
    );
  });

  it("is false when yarn fails", () => {
    strictEqual(yarnInstallsAreImmutable("/p", answering(1, "true")), false);
  });

  it("is false when yarn cannot be spawned", () => {
    strictEqual(
      yarnInstallsAreImmutable("/p", () => {
        throw new Error("spawnSync yarn ENOENT");
      }),
      false,
    );
  });
});
