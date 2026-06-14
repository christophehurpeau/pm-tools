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

  it("should display nested duplicates for typescript-eslint", () => {
    loadAndAssert(
      "../test/fixtures/duplicated-typescript-eslint/bun.lock",
      `Found 16 duplicates:

@eslint/plugin-kit:
  Resolutions:
    - @eslint/plugin-kit@0.6.1
    - @eslint/plugin-kit@0.7.2
  Dependents:
    - @eslint/json asking for "^0.6.1"
    - eslint asking for "^0.7.2"

@typescript-eslint/project-service:
  Resolutions:
    - @typescript-eslint/project-service@8.61.0
    - @typescript-eslint/project-service@8.59.1
  Dependents:
    - @typescript-eslint/typescript-estree asking for "8.61.0"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree asking for "8.59.1"

@typescript-eslint/scope-manager:
  Resolutions:
    - @typescript-eslint/scope-manager@8.61.0
    - @typescript-eslint/scope-manager@8.59.1
  Dependents:
    - @typescript-eslint/eslint-plugin asking for "8.61.0"
    - @typescript-eslint/parser asking for "8.61.0"
    - @typescript-eslint/utils asking for "8.59.1"
    - @typescript-eslint/eslint-plugin/@typescript-eslint/utils asking for "8.61.0"
    - @typescript-eslint/type-utils/@typescript-eslint/utils asking for "8.61.0"
    - typescript-eslint/@typescript-eslint/utils asking for "8.61.0"

@typescript-eslint/tsconfig-utils:
  Resolutions:
    - @typescript-eslint/tsconfig-utils@8.61.0
    - @typescript-eslint/tsconfig-utils@8.59.1
  Dependents:
    - @typescript-eslint/project-service asking for "^8.61.0"
    - @typescript-eslint/typescript-estree asking for "8.61.0"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree asking for "8.59.1"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree/@typescript-eslint/project-service asking for "^8.59.1"

@typescript-eslint/types:
  Resolutions:
    - @typescript-eslint/types@8.61.0
      Installed at:
        - @typescript-eslint/types
        - @typescript-eslint/utils/@typescript-eslint/typescript-estree/@typescript-eslint/project-service/@typescript-eslint/types
    - @typescript-eslint/types@8.59.1
  Dependents:
    - @typescript-eslint/parser asking for "8.61.0"
    - @typescript-eslint/project-service asking for "^8.61.0"
    - @typescript-eslint/scope-manager asking for "8.61.0"
    - @typescript-eslint/type-utils asking for "8.61.0"
    - @typescript-eslint/typescript-estree asking for "8.61.0"
    - @typescript-eslint/utils asking for "8.59.1"
    - @typescript-eslint/visitor-keys asking for "8.61.0"
    - eslint-plugin-import-x asking for "^8.56.0"
    - @typescript-eslint/eslint-plugin/@typescript-eslint/utils asking for "8.61.0"
    - @typescript-eslint/type-utils/@typescript-eslint/utils asking for "8.61.0"
    - @typescript-eslint/utils/@typescript-eslint/scope-manager asking for "8.59.1"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree asking for "8.59.1"
    - typescript-eslint/@typescript-eslint/utils asking for "8.61.0"
    - @typescript-eslint/utils/@typescript-eslint/scope-manager/@typescript-eslint/visitor-keys asking for "8.59.1"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree/@typescript-eslint/project-service asking for "^8.59.1"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree/@typescript-eslint/visitor-keys asking for "8.59.1"

@typescript-eslint/typescript-estree:
  Resolutions:
    - @typescript-eslint/typescript-estree@8.61.0
    - @typescript-eslint/typescript-estree@8.59.1
  Dependents:
    - @typescript-eslint/parser asking for "8.61.0"
    - @typescript-eslint/type-utils asking for "8.61.0"
    - @typescript-eslint/utils asking for "8.59.1"
    - typescript-eslint asking for "8.61.0"
    - @typescript-eslint/eslint-plugin/@typescript-eslint/utils asking for "8.61.0"
    - @typescript-eslint/type-utils/@typescript-eslint/utils asking for "8.61.0"
    - typescript-eslint/@typescript-eslint/utils asking for "8.61.0"

@typescript-eslint/utils:
  Resolutions:
    - @typescript-eslint/utils@8.59.1
    - @typescript-eslint/utils@8.61.0
      Installed at:
        - @typescript-eslint/eslint-plugin/@typescript-eslint/utils
        - @typescript-eslint/type-utils/@typescript-eslint/utils
        - typescript-eslint/@typescript-eslint/utils
  Dependents:
    - @pob/eslint-plugin asking for "8.59.1"
    - @typescript-eslint/eslint-plugin asking for "8.61.0"
    - @typescript-eslint/type-utils asking for "8.61.0"
    - typescript-eslint asking for "8.61.0"

@typescript-eslint/visitor-keys:
  Resolutions:
    - @typescript-eslint/visitor-keys@8.61.0
    - @typescript-eslint/visitor-keys@8.59.1
      Installed at:
        - @typescript-eslint/utils/@typescript-eslint/scope-manager/@typescript-eslint/visitor-keys
        - @typescript-eslint/utils/@typescript-eslint/typescript-estree/@typescript-eslint/visitor-keys
  Dependents:
    - @typescript-eslint/eslint-plugin asking for "8.61.0"
    - @typescript-eslint/parser asking for "8.61.0"
    - @typescript-eslint/scope-manager asking for "8.61.0"
    - @typescript-eslint/typescript-estree asking for "8.61.0"
    - @typescript-eslint/utils/@typescript-eslint/scope-manager asking for "8.59.1"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree asking for "8.59.1"

balanced-match:
  Resolutions:
    - balanced-match@4.0.4
    - balanced-match@1.0.2
  Dependents:
    - brace-expansion asking for "^4.0.2"
    - eslint-plugin-react/minimatch/brace-expansion asking for "^1.0.0"

brace-expansion:
  Resolutions:
    - brace-expansion@5.0.6
    - brace-expansion@1.1.15
  Dependents:
    - minimatch asking for "^5.0.5"
    - eslint-plugin-react/minimatch asking for "^1.1.7"

escape-string-regexp:
  Resolutions:
    - escape-string-regexp@4.0.0
    - escape-string-regexp@1.0.5
  Dependents:
    - clean-regexp asking for "^1.0.5"
    - eslint asking for "^4.0.0"

eslint-visitor-keys:
  Resolutions:
    - eslint-visitor-keys@5.0.1
    - eslint-visitor-keys@3.4.3
  Dependents:
    - @eslint-community/eslint-utils asking for "^3.4.3"
    - @typescript-eslint/visitor-keys asking for "^5.0.0"
    - eslint asking for "^5.0.1"
    - espree asking for "^5.0.1"
    - @typescript-eslint/utils/@typescript-eslint/scope-manager/@typescript-eslint/visitor-keys asking for "^5.0.0"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree/@typescript-eslint/visitor-keys asking for "^5.0.0"

globals:
  Resolutions:
    - globals@15.15.0
    - globals@17.6.0
  Dependents:
    - eslint-plugin-n asking for "^15.11.0"
    - eslint-plugin-unicorn asking for "^17.4.0"

ignore:
  Resolutions:
    - ignore@7.0.5
    - ignore@5.3.2
      Installed at:
        - eslint/ignore
        - eslint-plugin-n/ignore
  Dependents:
    - @typescript-eslint/eslint-plugin asking for "^7.0.5"
    - eslint asking for "^5.2.0"
    - eslint-plugin-n asking for "^5.3.2"

minimatch:
  Resolutions:
    - minimatch@10.2.5
    - minimatch@3.1.5
  Dependents:
    - @eslint/config-array asking for "^10.2.4"
    - @typescript-eslint/typescript-estree asking for "^10.2.2"
    - eslint asking for "^10.2.4"
    - eslint-plugin-import-x asking for "^9.0.3 || ^10.1.2"
    - eslint-plugin-react asking for "^3.1.2"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree asking for "^10.2.2"

semver:
  Resolutions:
    - semver@7.8.4
    - semver@6.3.1
      Installed at:
        - eslint-plugin-react/semver
        - node-exports-info/semver
  Dependents:
    - @typescript-eslint/typescript-estree asking for "^7.7.3"
    - eslint-compat-utils asking for "^7.5.4"
    - eslint-plugin-import-x asking for "^7.7.2"
    - eslint-plugin-n asking for "^7.6.3"
    - eslint-plugin-react asking for "^6.3.1"
    - eslint-plugin-unicorn asking for "^7.7.4"
    - node-exports-info asking for "^6.3.1"
    - @typescript-eslint/utils/@typescript-eslint/typescript-estree asking for "^7.7.3"
`,
    );
  });
});
