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

  // A `workspace:`, `catalog:`, `file:` or `link:` specifier names something
  // other than the npm package sharing its key, and a dist-tag carries no
  // comparable range. Recording them as ranges makes `semver.satisfies` answer
  // "not satisfied" for every candidate, suppressing merges the real dependents
  // allow.
  it("leaves out importer specifiers that are not npm ranges", () => {
    const dependents = collectPnpmDependents(lockFor("protocol-dependents"));

    deepStrictEqual([...dependents.keys()].toSorted(), ["app", "semver"]);

    // the importer declares `semver` as `latest`, so only the snapshot dependent
    // of `app` remains
    deepStrictEqual(dependents.get("semver"), [
      { key: "app@1.0.0", version: "7.8.1" },
    ]);

    for (const packageName of [
      "helper",
      "picocolors",
      "left-pad",
      "kleur",
      "chalk",
    ]) {
      strictEqual(dependents.has(packageName), false);
    }
  });

  it("keeps the range an aliased importer specifier declares", () => {
    const dependents = collectPnpmDependents(lockFor("mergeable-alias"), [
      "printable-shell-command",
    ]);

    deepStrictEqual(
      (dependents.get("printable-shell-command") ?? [])
        .filter((dependent) => dependent.key.startsWith("package.json"))
        .map((dependent) => dependent.version)
        .toSorted(),
      ["5.0.7", "^5.0.0"],
    );
  });

  // `aliased-swapped-names`: the importer declares `"@typescript/native":
  // "npm:typescript@7.0.2"` and `"typescript":
  // "npm:@typescript/typescript6@6.0.2"`, so each key names the other's package.
  // Filing either under its key would put an exact pin on the wrong package.
  it("files a swapped alias under the package its specifier targets", () => {
    const dependents = collectPnpmDependents(lockFor("aliased-swapped-names"));

    deepStrictEqual(dependents.get("typescript"), [
      { key: "package.json in devDependencies", version: "7.0.2" },
      { key: "tool@1.0.0", version: "5.9.3" },
    ]);

    deepStrictEqual(dependents.get("@typescript/typescript6"), [
      { key: "package.json in devDependencies", version: "6.0.2" },
    ]);
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
