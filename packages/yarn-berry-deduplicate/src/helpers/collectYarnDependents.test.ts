import { describe, expect, it } from "bun:test";
import { collectYarnDependents } from "./collectYarnDependents.ts";
import { loadFixture } from "./fixtures.ts";

const dependentsOf = (fixture: string, packageName: string) => {
  const { packages, workspaces } = loadFixture(fixture);
  return (
    collectYarnDependents({
      packages,
      workspaces,
      onlyPackageNames: [packageName],
    }).get(packageName) ?? []
  );
};

describe("collectYarnDependents", () => {
  it("records the range each requester declares and what it got", () => {
    const dependents = dependentsOf(
      "duplicated-printable-shell-command",
      "printable-shell-command",
    );

    expect(
      dependents.map(({ key, version, workspace, resolvedVersion }) => ({
        key,
        version,
        workspace,
        resolvedVersion,
      })),
    ).toEqual([
      {
        key: "package.json in dependencies",
        version: "^5.0.7",
        workspace: { path: "", depType: "dependencies" },
        resolvedVersion: "5.0.7",
      },
      {
        key: "uses-psc@npm:1.0.0",
        version: "^5.0.8",
        workspace: undefined,
        resolvedVersion: "5.0.8",
      },
    ]);
    expect(dependents[1]?.yarnPackage).toMatchObject({ name: "uses-psc" });
  });

  it("names the declaration an aliased range comes from", () => {
    const dependents = dependentsOf(
      "mergeable-alias",
      "printable-shell-command",
    );

    expect(
      dependents.map(({ aliasKey, version }) => ({ aliasKey, version })),
    ).toEqual([
      { aliasKey: undefined, version: "^5.0.8" },
      { aliasKey: "psc", version: "^5.0.0" },
    ]);
  });

  it("tells a workspace's dependency block from its devDependency block", () => {
    expect(
      dependentsOf("workspaces", "semver").map(({ key, workspace }) => ({
        key,
        workspace,
      })),
    ).toEqual([
      {
        key: "packages/app in devDependencies",
        workspace: { path: "packages/app", depType: "devDependencies" },
      },
      {
        key: "package.json in dependencies",
        workspace: { path: "", depType: "dependencies" },
      },
    ]);
  });

  // a git or workspace declaration names a different package that happens to
  // share the key; read as a range, it would satisfy nothing and suppress
  // merges the real dependents allow
  it("flags declarations semver cannot read, keeping them as written", () => {
    const { packages, workspaces } = loadFixture("non-npm");
    const dependents = collectYarnDependents({ packages, workspaces });

    expect(
      dependents.get("from-git")?.map(({ version, nonSemver }) => ({
        version,
        nonSemver,
      })),
    ).toEqual([
      {
        version: "https://github.com/example/from-git.git#commit=abc123",
        nonSemver: true,
      },
    ]);
    expect(
      dependents.get("local-lib")?.map(({ version, nonSemver }) => ({
        version,
        nonSemver,
      })),
    ).toEqual([{ version: "workspace:*", nonSemver: true }]);
    expect(dependents.get("lodash")).toEqual([
      expect.objectContaining({ version: "^4.17.0", nonSemver: undefined }),
    ]);
  });

  // the patched copy is a resolution of its own, and this declaration is the
  // only thing that asks for it; dropped, the report cannot explain it
  it("files a patch declaration under the resolution it names", () => {
    const dependents = dependentsOf("declared-patch", "lodash");

    expect(
      dependents.map(
        ({ key, version, resolvedVersion, resolvedResolution }) => ({
          key,
          version,
          resolvedVersion,
          resolvedResolution,
        }),
      ),
    ).toEqual([
      {
        key: "package.json in dependencies",
        version: "^4.17.0",
        resolvedVersion: "4.17.21",
        resolvedResolution: undefined,
      },
      {
        key: "uses-patched-lodash@npm:1.0.0",
        version: "patch:lodash@npm%3A4.17.21#./patches/lodash.patch",
        resolvedVersion: undefined,
        resolvedResolution:
          "lodash@patch:lodash@npm%3A4.17.21#./patches/lodash.patch::version=4.17.21&hash=1a2b3c",
      },
    ]);
  });

  // yarn writes a `patch:` entry repeating the base release's dependencies, and
  // the builtin compat layer alone makes several
  it("counts a constraint once when a patch entry repeats it", () => {
    const { packages, workspaces } = loadFixture("non-npm");
    const resolveDependents =
      collectYarnDependents({ packages, workspaces }).get("resolve") ?? [];

    expect(resolveDependents).toHaveLength(1);
    expect(resolveDependents[0]?.version).toBe("^1.22.8");
  });

  // yarn folds a peer provision into the virtual package's own dependencies, so
  // `yarn why` lists peer requesters; the lockfile keeps peer ranges in a block
  // of their own and reading `dependencies` alone loses the constraint
  it("counts a peerDependencies range as a constraint", () => {
    const dependents = dependentsOf("peer-range-constrains-merge", "peer-pkg");

    expect(
      dependents.map(({ key, version, peer, resolvedVersion }) => ({
        key,
        version,
        peer,
        resolvedVersion,
      })),
    ).toEqual([
      {
        key: "package.json in dependencies",
        version: "^2.0.0",
        peer: undefined,
        resolvedVersion: "2.1.0",
      },
      {
        key: "holder@npm:2.0.0",
        version: "*",
        peer: undefined,
        resolvedVersion: "1.5.0",
      },
      // a peer range is not a descriptor yarn resolves, so which copy the
      // requester was handed is its parent's business, not the lockfile's
      {
        key: "uses-peer@npm:1.0.0",
        version: "^1.0.0",
        peer: true,
        resolvedVersion: undefined,
      },
    ]);
  });

  it("restricts collection to the named packages", () => {
    const { packages, workspaces } = loadFixture("workspaces");
    const dependents = collectYarnDependents({
      packages,
      workspaces,
      onlyPackageNames: ["semver"],
    });

    expect([...dependents.keys()]).toEqual(["semver"]);
  });
});
