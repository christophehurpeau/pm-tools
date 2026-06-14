import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readPnpmLock } from "../readPnpmLock.ts";
import { collectPnpmDependents } from "./collectPnpmDependents.ts";

const fixturesBase = (rel: string) =>
  fileURLToPath(new URL(rel, import.meta.url));

const lockFor = (scenario: string) =>
  readPnpmLock(fixturesBase(`../../test/fixtures/${scenario}/pnpm-lock.yaml`));

describe("collectPnpmDependents", () => {
  it("collects the importer specifier (range) for a direct dependency", () => {
    const dependents = collectPnpmDependents(lockFor("simple"));
    deepStrictEqual(dependents.get("semver"), [
      { key: "package.json in dependencies", version: "7.7.3" },
    ]);
  });

  it("collects both importer range and transitive resolved versions", () => {
    const dependents = collectPnpmDependents(
      lockFor("duplicated-babel-frame"),
      ["@babel/code-frame"],
    );
    const codeFrame = dependents.get("@babel/code-frame");
    ok(codeFrame);
    // direct importer dependency carries the specifier range
    ok(
      codeFrame.some(
        (dependent) =>
          dependent.key === "package.json in dependencies" &&
          dependent.version === "7.26.2",
      ),
    );
    // transitive dependents carry a resolved version
    ok(codeFrame.some((dependent) => dependent.version === "7.29.7"));
    ok(codeFrame.length >= 2);
  });

  it("restricts results to onlyPackageNames", () => {
    const dependents = collectPnpmDependents(
      lockFor("duplicated-printable-shell-command"),
      ["printable-shell-command"],
    );
    strictEqual(
      [...dependents.keys()].every(
        (name) => name === "printable-shell-command",
      ),
      true,
    );
    ok(dependents.get("printable-shell-command"));
  });
});
