import {
  deepStrictEqual,
  partialDeepStrictEqual,
  throws,
} from "node:assert/strict";
import { describe, it } from "node:test";
import { parseYarnDescriptor, splitEntryKey } from "./yarnDescriptor.ts";

describe("parseYarnDescriptor", () => {
  it("reads a plain range", () => {
    partialDeepStrictEqual(parseYarnDescriptor("lodash@npm:^4.17.0"), {
      key: "lodash",
      npmName: "lodash",
      protocol: "npm",
      isAlias: false,
      selector: "^4.17.0",
    });
  });

  it("reads a scoped name", () => {
    partialDeepStrictEqual(
      parseYarnDescriptor("@babel/code-frame@npm:^7.26.2"),
      {
        key: "@babel/code-frame",
        npmName: "@babel/code-frame",
        selector: "^7.26.2",
      },
    );
  });

  // the alias target carries the range; the whole `name@range` selector is not
  // something any semver call accepts
  it("takes an alias's requested range from its target", () => {
    partialDeepStrictEqual(
      parseYarnDescriptor("psc@npm:printable-shell-command@^5.0.0"),
      {
        key: "psc",
        npmName: "printable-shell-command",
        isAlias: true,
        selector: "^5.0.0",
      },
    );
  });

  it("reads the non-npm protocols yarn writes", () => {
    partialDeepStrictEqual(parseYarnDescriptor("app@workspace:packages/app"), {
      npmName: "app",
      protocol: "workspace",
      selector: "packages/app",
    });
    partialDeepStrictEqual(
      parseYarnDescriptor(
        "resolve@patch:resolve@npm%3A^1.22.8#optional!builtin<compat/resolve>",
      ),
      { npmName: "resolve", protocol: "patch" },
    );
  });

  it("refuses a descriptor carrying no range", () => {
    throws(
      () => parseYarnDescriptor("lodash"),
      /Invalid yarn descriptor without range: lodash/u,
    );
  });
});

describe("splitEntryKey", () => {
  it("splits the descriptors a lockfile key covers", () => {
    deepStrictEqual(
      splitEntryKey(
        "@babel/code-frame@npm:7.10.4, @babel/code-frame@npm:~7.10.4",
      ),
      ["@babel/code-frame@npm:7.10.4", "@babel/code-frame@npm:~7.10.4"],
    );
  });

  it("leaves a single descriptor alone", () => {
    deepStrictEqual(splitEntryKey("lodash@npm:^4.17.0"), [
      "lodash@npm:^4.17.0",
    ]);
  });
});
