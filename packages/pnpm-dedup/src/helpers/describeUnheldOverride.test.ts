import { deepStrictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { describeUnheldOverride } from "./describeUnheldOverride.ts";

describe("describeUnheldOverride", () => {
  it("names a requester once, whatever its peer contexts", () => {
    deepStrictEqual(
      describeUnheldOverride(
        { packageName: "lightningcss", version: "1.30.1", reason: "converge" },
        [
          // two installations of one requester, one already repointed
          {
            key: "react-native-css@3.1.0-rc.0",
            range: ">=1.27.0",
            resolvedVersion: "1.30.1",
            requesterName: "react-native-css",
            peer: true,
          },
          {
            key: "react-native-css@3.1.0-rc.0",
            range: ">=1.27.0",
            resolvedVersion: "1.33.0",
            requesterName: "react-native-css",
            peer: true,
          },
          {
            key: "react-native-css@3.1.0-rc.0",
            range: ">=1.27.0",
            resolvedVersion: "1.33.0",
            requesterName: "react-native-css",
            peer: true,
          },
          {
            key: "vite@8.3.0",
            range: "^1.33.0",
            resolvedVersion: "1.33.0",
            requesterName: "vite",
          },
        ],
      ),
      [
        'vite@8.3.0 requires "^1.33.0"',
        'react-native-css@3.1.0-rc.0 requires ">=1.27.0" (peer), is provided 1.33.0',
      ],
    );
  });

  it("lists the ranges that reject the version first", () => {
    deepStrictEqual(
      describeUnheldOverride(
        {
          packageName: "@commitlint/types",
          version: "21.0.1",
          reason: "converge",
        },
        [
          {
            key: "@commitlint/format@21.0.1",
            range: "^21.0.1",
            resolvedVersion: "21.1.0",
            requesterName: "@commitlint/format",
          },
          {
            key: "@commitlint/rules@21.1.0",
            range: "^21.1.0",
            resolvedVersion: "21.1.0",
            requesterName: "@commitlint/rules",
          },
          {
            key: "@pob/root@27.11.0",
            range: "21.0.1",
            resolvedVersion: "21.0.1",
            requesterName: "@pob/root",
          },
        ],
      ),
      [
        '@commitlint/rules@21.1.0 requires "^21.1.0"',
        '@commitlint/format@21.0.1 requires "^21.0.1", resolves 21.1.0 without an override',
      ],
    );
  });

  it("names an importer by its manifest and dependency type", () => {
    deepStrictEqual(
      describeUnheldOverride(
        { packageName: "leaf", version: "2.0.0", reason: "converge" },
        [
          {
            key: "package.json in devDependencies",
            range: "1.0.0",
            resolvedVersion: "1.0.0",
            workspace: { path: ".", depType: "devDependencies" },
          },
        ],
      ),
      ['package.json in devDependencies requires "1.0.0"'],
    );
  });
});
