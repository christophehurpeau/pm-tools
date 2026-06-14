/* eslint-disable unicorn/no-array-sort */
import { describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readAndParseBunLock } from "../readAndParseBunLock.ts";
import { parseBunLockPackages } from "./parseBunLockPackages.ts";

const fixturesBase = (rel: string) =>
  fileURLToPath(new URL(rel, import.meta.url));

describe("parseBunLockPackages", () => {
  it("parses simple bun.lock fixture", () => {
    const fixturePath = fixturesBase("../../test/fixtures/simple/bun.lock");
    const bunLock = readAndParseBunLock(fixturePath);

    const packages = parseBunLockPackages(bunLock);

    // simple fixture contains a single package
    strictEqual(packages.size, 1);

    const semver = packages.get("semver");
    strictEqual(semver?.type, "npm");
    strictEqual(semver.name, "semver");
    strictEqual(semver.resolution, "semver@7.7.3");
    strictEqual(semver.registry, "");
    deepStrictEqual(semver.info, { bin: { semver: "bin/semver.js" } });
    strictEqual(
      semver.integrity,
      "sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==",
    );
  });

  // Parameterized test: check every non-npm package declared in the non-npm fixture
  // NOTE: we (the test author) read the fixture package.json outside of the test
  // editing step and populate this table so the test itself does not read package.json.
  it.each([
    ["react", "tarball"],
    ["dayjs", "github"],
    ["lodash", "git"],
    ["moment", "git"],
    ["zod", "github"],
  ])("parses non-npm package %s", (pkgName: string, expectedType: string) => {
    const fixturePath = fixturesBase("../../test/fixtures/non-npm/bun.lock");
    const bunLock = readAndParseBunLock(fixturePath);

    const packages = parseBunLockPackages(bunLock);

    // the non-npm fixture contains many entries
    strictEqual(packages.size, 13);

    const pkg = packages.get(pkgName)!;
    strictEqual(pkg.type, expectedType as any);

    // Additional focused assertions for some packages
    if (pkg.type === "tarball" && pkgName === "react") {
      strictEqual(pkg.name, "react");
      // tarball url should reference the react tarball
      strictEqual(pkg.tarball.includes("react-18.2.0.tgz"), true);
      deepStrictEqual((pkg as any).info, {
        dependencies: { "loose-envify": "^1.1.0" },
      });
    }

    if (pkg.type === "github") {
      if (pkgName === "dayjs") {
        strictEqual((pkg as any).user, "iamkun");
        strictEqual((pkg as any).repo, "dayjs#02b7a5c");
      }
      if (pkgName === "zod") {
        strictEqual((pkg as any).user, "colinhacks");
        strictEqual((pkg as any).repo, "zod#c3ec66c");
      }
    }

    if (pkg.type === "git") {
      // repo string should be present for git entries
      strictEqual(typeof (pkg as any).repo === "string", true);
      strictEqual((pkg as any).repo.length > 0, true);
    }
  });

  const ExcludesFalsy = Boolean as unknown as <T>(
    value: T | false | null | undefined,
  ) => value is T;

  it("parses duplicated-babel-frame fixture", () => {
    const fixturePath = fixturesBase(
      "../../test/fixtures/duplicated-babel-frame/bun.lock",
    );
    const bunLock = readAndParseBunLock(fixturePath);

    const packages = parseBunLockPackages(bunLock);

    // collect resolution strings present on parsed packages
    const resolutions = [...packages.values()]
      .map((p) => (p.type === "npm" ? p.resolution : undefined))
      .filter(ExcludesFalsy);

    // ensure both versions of @babel/code-frame are present
    strictEqual(
      resolutions.some((r) => r.includes("@babel/code-frame@7.26.2")),
      true,
    );
    strictEqual(
      resolutions.some((r) => r.includes("@babel/code-frame@7.27.1")),
      true,
    );

    strictEqual(packages.has("@babel/code-frame"), true);
    strictEqual(packages.has("@babel/core/@babel/code-frame"), true);

    const topBabelCodeFrame = packages.get("@babel/code-frame");
    strictEqual(topBabelCodeFrame?.type, "npm");
    strictEqual(topBabelCodeFrame.version, "7.26.2");
    strictEqual(topBabelCodeFrame.resolution, "@babel/code-frame@7.26.2");
    strictEqual(topBabelCodeFrame.name, "@babel/code-frame");

    // top package should declare these dependencies
    const topDeps = Object.keys(
      topBabelCodeFrame.info?.dependencies ?? {},
    ).sort();
    deepStrictEqual(
      topDeps,
      ["@babel/helper-validator-identifier", "js-tokens", "picocolors"].sort(),
    );

    const nestedBabelCodeFrame = packages.get("@babel/core/@babel/code-frame");
    strictEqual(nestedBabelCodeFrame?.type, "npm");
    strictEqual(nestedBabelCodeFrame.version, "7.27.1");
    strictEqual(nestedBabelCodeFrame.name, "@babel/code-frame");
    strictEqual(nestedBabelCodeFrame.resolution, "@babel/code-frame@7.27.1");
    strictEqual(
      nestedBabelCodeFrame.resolution.includes("@babel/code-frame@7.27.1"),
      true,
    );
    const nestedDeps = Object.keys(
      nestedBabelCodeFrame.info?.dependencies ?? {},
    ).sort();
    deepStrictEqual(
      nestedDeps,
      ["@babel/helper-validator-identifier", "js-tokens", "picocolors"].sort(),
    );

    // no deep strict equal here. Ensure a samed resolved package installed in two places is the same object.
    strictEqual(
      packages.get("@babel/core/@babel/code-frame"),
      packages.get("@babel/template/@babel/code-frame"),
    );

    // There should be two different package objects with name '@babel/code-frame'
    const codeFrameDependencies = [...packages.values()].filter(
      (p) => p.type === "npm" && p.name === "@babel/code-frame",
    );
    strictEqual(codeFrameDependencies.length, 4);
  });
});
