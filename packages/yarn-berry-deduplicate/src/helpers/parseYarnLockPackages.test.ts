import {
  deepStrictEqual,
  partialDeepStrictEqual,
  strictEqual,
} from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFixture } from "./fixtures.ts";
import { parseYarnLockPackages } from "./parseYarnLockPackages.ts";
import { parseYarnLock } from "./syml.ts";

describe("parseYarnLockPackages", () => {
  it("keys every descriptor a lockfile entry covers", () => {
    const { packages } = loadFixture("duplicated-printable-shell-command");

    partialDeepStrictEqual(packages.get("printable-shell-command@npm:^5.0.7"), {
      type: "npm",
      name: "printable-shell-command",
      resolution: "printable-shell-command@npm:5.0.7",
      version: "5.0.7",
    });
    partialDeepStrictEqual(packages.get("printable-shell-command@npm:^5.0.8"), {
      type: "npm",
      version: "5.0.8",
    });
  });

  it("shares one package across the descriptors of an entry", () => {
    const packages = parseYarnLockPackages(
      parseYarnLock(`__metadata:
  version: 8

"lodash@npm:^4.0.0, lodash@npm:^4.17.0":
  version: 4.17.21
  resolution: "lodash@npm:4.17.21"
`),
    );

    strictEqual(
      packages.get("lodash@npm:^4.0.0"),
      packages.get("lodash@npm:^4.17.0"),
    );
  });

  // the alias resolves to the target's own resolution, so the package is named
  // after what it really is
  it("names an aliased descriptor after the package it resolves to", () => {
    const { packages } = loadFixture("mergeable-alias");

    partialDeepStrictEqual(
      packages.get("psc@npm:printable-shell-command@^5.0.0"),
      {
        type: "npm",
        name: "printable-shell-command",
        version: "5.0.7",
      },
    );
  });

  it("keeps non-npm protocols out of the npm pool", () => {
    const { packages } = loadFixture("non-npm");

    partialDeepStrictEqual(
      packages.get("local-lib@workspace:packages/local-lib"),
      { type: "other", protocol: "workspace" },
    );
    partialDeepStrictEqual(
      packages.get(
        "resolve@patch:resolve@npm%3A^1.22.8#optional!builtin<compat/resolve>",
      ),
      { type: "other", protocol: "patch" },
    );
    partialDeepStrictEqual(packages.get("resolve@npm:^1.22.8"), {
      type: "npm",
    });
  });

  // yarn 2 wrote a virtual entry per peer context; one release installed under
  // three contexts is one version, not three duplicates
  it("collapses a virtual resolution onto the release it wraps", () => {
    const packages = parseYarnLockPackages(
      parseYarnLock(`__metadata:
  version: 8

"react-dom@virtual:aaaa#npm:^18.0.0":
  version: 18.3.1
  resolution: "react-dom@virtual:aaaa#npm:18.3.1"

"react-dom@virtual:bbbb#npm:^18.0.0":
  version: 18.3.1
  resolution: "react-dom@virtual:bbbb#npm:18.3.1"
`),
    );

    const resolutions = new Set(
      [...packages.values()].map((pkg) => pkg.resolution),
    );
    deepStrictEqual([...resolutions], ["react-dom@npm:18.3.1"]);
  });
});
