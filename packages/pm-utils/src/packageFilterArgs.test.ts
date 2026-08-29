import { describe, it } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseArgs } from "node:util";
import {
  toPackageFilterOptions,
  toWhyDuplicateRequest,
  whyDuplicateParseArgsOptions,
} from "./packageFilterArgs.ts";

const parseFlags = (args: string[]) =>
  parseArgs({
    args,
    options: { ...whyDuplicateParseArgsOptions },
    allowPositionals: true,
  });

const parse = (args: string[]) =>
  toPackageFilterOptions(parseFlags(args).values);

const request = (args: string[]) => {
  const { values, positionals } = parseFlags(args);
  return toWhyDuplicateRequest(values, positionals);
};

describe("toPackageFilterOptions", () => {
  it("leaves every list undefined when no flag is passed", () => {
    deepStrictEqual(parse([]), {
      include: undefined,
      includeScopes: undefined,
      exclude: undefined,
      excludeScopes: undefined,
    });
  });

  it("reads the four flags", () => {
    deepStrictEqual(
      parse([
        "--packages",
        "lodash",
        "--scopes",
        "@babel",
        "--exclude",
        "react",
        "--exclude-scopes",
        "@types",
      ]),
      {
        include: ["lodash"],
        includeScopes: ["@babel"],
        exclude: ["react"],
        excludeScopes: ["@types"],
      },
    );
  });

  it("reads a repeated flag and a comma list the same way", () => {
    const repeated = parse(["--packages", "lodash", "--packages", "react"]);
    const commaSeparated = parse(["--packages", "lodash,react"]);

    deepStrictEqual(repeated.include, ["lodash", "react"]);
    deepStrictEqual(commaSeparated.include, ["lodash", "react"]);
  });

  it("drops the blanks a trailing comma or a stray space leaves behind", () => {
    deepStrictEqual(parse(["--packages", " lodash , ,"]).include, ["lodash"]);
    deepStrictEqual(parse(["--packages", ","]).include, undefined);
  });
});

describe("toWhyDuplicateRequest", () => {
  it("takes a positional as an included name", () => {
    deepStrictEqual(request(["lodash"]), {
      filter: {
        include: ["lodash"],
        includeScopes: undefined,
        exclude: undefined,
        excludeScopes: undefined,
      },
      explains: true,
      all: false,
      // naming a package is asking why, which the one-line form does not answer
      details: true,
    });
  });

  it("merges the positionals with the names the flag carries", () => {
    deepStrictEqual(request(["--packages", "lodash", "react"]).filter.include, [
      "lodash",
      "react",
    ]);
  });

  it("explains a scope with nothing named", () => {
    const { filter, explains } = request(["--scopes", "@babel"]);

    deepStrictEqual(filter.include, undefined);
    deepStrictEqual(filter.includeScopes, ["@babel"]);
    deepStrictEqual(explains, true);
  });

  it("lists the whole lockfile when only exclusions are given", () => {
    deepStrictEqual(request(["--exclude", "lodash"]).explains, false);
    deepStrictEqual(request([]).explains, false);
  });

  it("leaves a listing on one line per package until --details is asked for", () => {
    deepStrictEqual(request([]).details, false);
    deepStrictEqual(request(["--details"]).details, true);
    deepStrictEqual(request(["-d"]).details, true);
  });

  it("reads --all", () => {
    deepStrictEqual(request(["lodash"]).all, false);
    deepStrictEqual(request(["lodash", "--all"]).all, true);
  });
});
