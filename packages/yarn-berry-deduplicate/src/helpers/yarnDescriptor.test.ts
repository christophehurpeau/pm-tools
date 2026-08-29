import { describe, expect, it } from "bun:test";
import { parseYarnDescriptor, splitEntryKey } from "./yarnDescriptor.ts";

describe("parseYarnDescriptor", () => {
  it("reads a plain range", () => {
    expect(parseYarnDescriptor("lodash@npm:^4.17.0")).toMatchObject({
      key: "lodash",
      npmName: "lodash",
      protocol: "npm",
      isAlias: false,
      selector: "^4.17.0",
    });
  });

  it("reads a scoped name", () => {
    expect(parseYarnDescriptor("@babel/code-frame@npm:^7.26.2")).toMatchObject({
      key: "@babel/code-frame",
      npmName: "@babel/code-frame",
      selector: "^7.26.2",
    });
  });

  // the alias target carries the range; the whole `name@range` selector is not
  // something any semver call accepts
  it("takes an alias's requested range from its target", () => {
    expect(
      parseYarnDescriptor("psc@npm:printable-shell-command@^5.0.0"),
    ).toMatchObject({
      key: "psc",
      npmName: "printable-shell-command",
      isAlias: true,
      selector: "^5.0.0",
    });
  });

  it("reads the non-npm protocols yarn writes", () => {
    expect(parseYarnDescriptor("app@workspace:packages/app")).toMatchObject({
      npmName: "app",
      protocol: "workspace",
      selector: "packages/app",
    });
    expect(
      parseYarnDescriptor(
        "resolve@patch:resolve@npm%3A^1.22.8#optional!builtin<compat/resolve>",
      ),
    ).toMatchObject({ npmName: "resolve", protocol: "patch" });
  });

  it("refuses a descriptor carrying no range", () => {
    expect(() => parseYarnDescriptor("lodash")).toThrow(
      "Invalid yarn descriptor without range: lodash",
    );
  });
});

describe("splitEntryKey", () => {
  it("splits the descriptors a lockfile key covers", () => {
    expect(
      splitEntryKey(
        "@babel/code-frame@npm:7.10.4, @babel/code-frame@npm:~7.10.4",
      ),
    ).toEqual([
      "@babel/code-frame@npm:7.10.4",
      "@babel/code-frame@npm:~7.10.4",
    ]);
  });

  it("leaves a single descriptor alone", () => {
    expect(splitEntryKey("lodash@npm:^4.17.0")).toEqual(["lodash@npm:^4.17.0"]);
  });
});
