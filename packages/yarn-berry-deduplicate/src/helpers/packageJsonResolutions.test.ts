import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { addResolutions } from "./packageJsonResolutions.ts";

describe("addResolutions", () => {
  it("adds a resolutions block, keeping the file's indentation", () => {
    const content = `{\n    "name": "app"\n}\n`;

    strictEqual(
      addResolutions(content, new Map([["lodash", "4.17.21"]])),
      `{\n    "name": "app",\n    "resolutions": {\n        "lodash": "4.17.21"\n    }\n}\n`,
    );
  });

  it("merges into the resolutions already declared", () => {
    const content = `{\n  "resolutions": {\n    "semver": "7.7.3"\n  }\n}\n`;

    deepStrictEqual(
      JSON.parse(addResolutions(content, new Map([["lodash", "4.17.21"]]))),
      { resolutions: { semver: "7.7.3", lodash: "4.17.21" } },
    );
  });

  it("overwrites a resolution already there", () => {
    const content = `{\n  "resolutions": {\n    "lodash": "4.0.0"\n  }\n}\n`;

    deepStrictEqual(
      JSON.parse(addResolutions(content, new Map([["lodash", "4.17.21"]]))),
      { resolutions: { lodash: "4.17.21" } },
    );
  });
});
