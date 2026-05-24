import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { displayMany } from "./displayMany.ts";
import {
  buildPackagesMap,
  filterDuplicatesPackagesMap,
} from "./helpers/buildPackagesMap.ts";
import { collectDependents } from "./helpers/collectDependents.ts";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.ts";
import { readAndParseBunLock } from "./readAndParseBunLock.ts";

describe("displayMany", () => {
  const loadAndAssert = (fixtureUrl: string, expected: string) => {
    // TODO this should use the method dedicated instead.
    const fixturePath = fileURLToPath(new URL(fixtureUrl, import.meta.url));
    const bunLock = readAndParseBunLock(fixturePath);
    const packages = parseBunLockPackages(bunLock);
    const packagesMap = buildPackagesMap(packages);
    const duplicates = filterDuplicatesPackagesMap(packagesMap);
    const dependents = collectDependents(
      packages,
      bunLock.workspaces,
      Object.keys(duplicates),
    );

    let buffer = "";
    const log = (message = "") => {
      buffer += `${message}\n`;
    };

    displayMany("duplicates", duplicates, dependents, undefined, log);

    expect(buffer).toBe(expected);
  };

  it("should display duplicates with all their dependents", () => {
    loadAndAssert(
      "../test/fixtures/duplicated-babel-frame/bun.lock",
      `Found 1 duplicate:

@babel/code-frame:
  Resolutions:
    - @babel/code-frame@7.26.2
    - @babel/code-frame@7.27.1
      Installed at:
        - @babel/core/@babel/code-frame
        - @babel/template/@babel/code-frame
        - @babel/traverse/@babel/code-frame
  Dependents:
    - package.json in dependencies asking for "7.26.2"
    - @babel/core asking for "^7.25.9"
    - @babel/template asking for "^7.27.1"
    - @babel/traverse asking for "^7.27.1"
`,
    );
  });

  it("should display duplicates with their dependents, when filtered", () => {
    loadAndAssert(
      "../test/fixtures/duplicated-babel-frame/bun.lock",
      `Found 1 duplicate:

@babel/code-frame:
  Resolutions:
    - @babel/code-frame@7.26.2
    - @babel/code-frame@7.27.1
      Installed at:
        - @babel/core/@babel/code-frame
        - @babel/template/@babel/code-frame
        - @babel/traverse/@babel/code-frame
  Dependents:
    - package.json in dependencies asking for "7.26.2"
    - @babel/core asking for "^7.25.9"
    - @babel/template asking for "^7.27.1"
    - @babel/traverse asking for "^7.27.1"
`,
    );
  });

  it("should display duplicates for printable-shell-command", () => {
    loadAndAssert(
      "../test/fixtures/duplicated-printable-shell-command/bun.lock",
      `Found 1 duplicate:

printable-shell-command:
  Resolutions:
    - printable-shell-command@5.0.7
    - printable-shell-command@5.0.8
  Dependents:
    - package.json in dependencies asking for "^5.0.7"
    - betterdisplaycli asking for "^5.0.8"
`,
    );
  });
});
