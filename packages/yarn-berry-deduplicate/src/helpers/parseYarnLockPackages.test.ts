import { describe, expect, it } from "bun:test";
import { loadFixture } from "./fixtures.ts";
import { parseYarnLockPackages } from "./parseYarnLockPackages.ts";
import { parseYarnLock } from "./syml.ts";

describe("parseYarnLockPackages", () => {
  it("keys every descriptor a lockfile entry covers", () => {
    const { packages } = loadFixture("duplicated-printable-shell-command");

    expect(packages.get("printable-shell-command@npm:^5.0.7")).toMatchObject({
      type: "npm",
      name: "printable-shell-command",
      resolution: "printable-shell-command@npm:5.0.7",
      version: "5.0.7",
    });
    expect(packages.get("printable-shell-command@npm:^5.0.8")).toMatchObject({
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

    expect(packages.get("lodash@npm:^4.0.0")).toBe(
      packages.get("lodash@npm:^4.17.0"),
    );
  });

  // the alias resolves to the target's own resolution, so the package is named
  // after what it really is
  it("names an aliased descriptor after the package it resolves to", () => {
    const { packages } = loadFixture("mergeable-alias");

    expect(
      packages.get("psc@npm:printable-shell-command@^5.0.0"),
    ).toMatchObject({
      type: "npm",
      name: "printable-shell-command",
      version: "5.0.7",
    });
  });

  it("keeps non-npm protocols out of the npm pool", () => {
    const { packages } = loadFixture("non-npm");

    expect(
      packages.get("local-lib@workspace:packages/local-lib"),
    ).toMatchObject({ type: "other", protocol: "workspace" });
    expect(
      packages.get(
        "resolve@patch:resolve@npm%3A^1.22.8#optional!builtin<compat/resolve>",
      ),
    ).toMatchObject({ type: "other", protocol: "patch" });
    expect(packages.get("resolve@npm:^1.22.8")).toMatchObject({ type: "npm" });
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
    expect([...resolutions]).toEqual(["react-dom@npm:18.3.1"]);
  });
});
