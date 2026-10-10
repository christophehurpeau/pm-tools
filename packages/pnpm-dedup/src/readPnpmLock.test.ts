import { deepStrictEqual, ok, throws } from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createTempProjects } from "./helpers/tempProjects.ts";
import { readPnpmLock } from "./readPnpmLock.ts";

const fixtureLock = (scenario: string): string =>
  fileURLToPath(
    new URL(`../test/fixtures/${scenario}/pnpm-lock.yaml`, import.meta.url),
  );

const projects = createTempProjects("pnpm-dedup-read-lock-");

afterEach(projects.cleanup);

const writeLock = (content: string): string => {
  const path = join(projects.create(), "pnpm-lock.yaml");
  writeFileSync(path, content);
  return path;
};

describe("readPnpmLock", () => {
  it("returns the project document of a lockfile that also resolves the package manager", () => {
    const lock = readPnpmLock(fixtureLock("package-manager-document"));

    deepStrictEqual(Object.keys(lock.importers?.["."] ?? {}), ["dependencies"]);
    const packageIds = Object.keys(lock.packages ?? {});
    ok(packageIds.includes("printable-shell-command@5.0.7"));
    ok(!packageIds.some((id) => id.startsWith("@pnpm/exe")));
  });

  it("reads the same project as the single-document lockfile", () => {
    deepStrictEqual(
      readPnpmLock(fixtureLock("package-manager-document")),
      readPnpmLock(fixtureLock("duplicated-printable-shell-command")),
    );
  });

  it("throws on malformed yaml", () => {
    throws(
      () => readPnpmLock(writeLock("lockfileVersion: '9.0'\nimporters: [\n")),
      { name: "YAMLParseError" },
    );
  });

  it("throws when only the package-manager document is present", () => {
    const path = writeLock(
      "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    packageManagerDependencies:\n      pnpm:\n        specifier: ^12.0.0\n        version: 12.10.1\n",
    );

    throws(() => readPnpmLock(path), {
      message: `No project lockfile document found in ${path}`,
    });
  });

  it("throws on an empty file", () => {
    const path = writeLock("");

    throws(() => readPnpmLock(path), {
      message: `No project lockfile document found in ${path}`,
    });
  });
});
