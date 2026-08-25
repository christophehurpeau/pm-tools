import { describe, it } from "bun:test";
import { strictEqual } from "node:assert/strict";
import { addOverrides } from "./packageJsonOverrides.ts";

describe("addOverrides", () => {
  it("adds an overrides block keeping the manifest indentation", () => {
    strictEqual(
      addOverrides(
        ["{", '    "name": "root"', "}", ""].join("\n"),
        new Map([["metro", "0.84.5"]]),
      ),
      [
        "{",
        '    "name": "root",',
        '    "overrides": {',
        '        "metro": "0.84.5"',
        "    }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("merges into the overrides already declared", () => {
    strictEqual(
      addOverrides(
        ["{", '  "overrides": {', '    "semver": "7.6.0"', "  }", "}", ""].join(
          "\n",
        ),
        new Map([["metro", "0.84.5"]]),
      ),
      [
        "{",
        '  "overrides": {',
        '    "semver": "7.6.0",',
        '    "metro": "0.84.5"',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });
});
