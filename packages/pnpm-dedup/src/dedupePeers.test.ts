import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.ts";
import type { PackagesMap } from "./helpers/buildPnpmPackagesMap.ts";
import { parsePackageId } from "./helpers/parsePnpmLockPackages.ts";
import {
  buildPnpmPackagesMap,
  collectPnpmDependents,
  filterDuplicatesPnpmPackagesMap,
  parsePnpmLockPackages,
  readPnpmLock,
} from "./index.ts";

// Both fixtures declare the same single dependency; only the `dedupePeers`
// setting differs. With it enabled pnpm writes peer suffixes as plain
// `name@version` instead of repeating the peer's own resolution, so snapshot
// ids lose their nesting:
//   default:     pkg@1(peer@2(eslint@10)(typescript@6))(eslint@10)(typescript@6)
//   dedupePeers: pkg@1(peer@2)(eslint@10)(typescript@6)
const defaultScenario = "duplicated-typescript-eslint";
const dedupePeersScenario = "duplicated-typescript-eslint-dedupe-peers";

// `mergeable-alias` pins the same package twice, once through an npm alias
// (`npm:printable-shell-command@5.0.7`) and once through a range that also
// accepts that pin. It is the same pair: identical manifests, `dedupePeers`
// only set in `mergeable-alias-dedupe-peers`.
const mergeableDefaultScenario = "mergeable-alias";
const mergeableDedupePeersScenario = "mergeable-alias-dedupe-peers";

const lockFor = (scenario: string) =>
  readPnpmLock(
    fileURLToPath(
      new URL(`../test/fixtures/${scenario}/pnpm-lock.yaml`, import.meta.url),
    ),
  );

const maxParenDepth = (id: string): number => {
  let depth = 0;
  let max = 0;
  for (const char of id) {
    if (char === "(") {
      depth += 1;
      max = Math.max(max, depth);
    } else if (char === ")") {
      depth -= 1;
    }
  }
  return max;
};

const snapshotIds = (scenario: string): string[] =>
  Object.keys(lockFor(scenario).snapshots ?? {});

const duplicatesFor = (scenario: string): PackagesMap =>
  filterDuplicatesPnpmPackagesMap(
    buildPnpmPackagesMap(parsePnpmLockPackages(lockFor(scenario))),
  );

const fixesFor = (
  scenario: string,
): ReturnType<typeof buildIdentifiedFixesMap> => {
  const lock = lockFor(scenario);
  const duplicates = duplicatesFor(scenario);
  return buildIdentifiedFixesMap(
    duplicates,
    collectPnpmDependents(lock, Object.keys(duplicates)),
  );
};

describe("dedupePeers lockfiles", () => {
  it("uses a fixture generated with the setting enabled", () => {
    strictEqual(lockFor(dedupePeersScenario).settings?.dedupePeers, true);
    strictEqual(lockFor(defaultScenario).settings?.dedupePeers, undefined);
  });

  it("flattens the peer suffixes the default settings nest", () => {
    ok(
      snapshotIds(defaultScenario).some((id) => maxParenDepth(id) > 1),
      "the default-settings fixture should contain nested peer suffixes",
    );
    deepStrictEqual(
      snapshotIds(dedupePeersScenario).filter((id) => maxParenDepth(id) > 1),
      [],
    );
  });

  it("parses name and version out of a flattened peer suffix", () => {
    const suffixed = snapshotIds(dedupePeersScenario).filter((id) =>
      id.includes("("),
    );
    ok(suffixed.length > 0);
    for (const id of suffixed) {
      const { name, version } = parsePackageId(id);
      ok(!name.includes("("), `name should not keep the suffix: ${id}`);
      ok(/^\d/u.test(version), `version should be resolved: ${id}`);
    }
  });

  it("groups every peer context of a resolution into installations", () => {
    const { packages, installationsByResolution } = parsePnpmLockPackages(
      lockFor(dedupePeersScenario),
    );
    const utils = installationsByResolution.get(
      "@typescript-eslint/utils@8.67.0",
    );
    ok(utils);
    ok(utils.every((id) => id.startsWith("@typescript-eslint/utils@8.67.0")));
    strictEqual(
      [...installationsByResolution.keys()].every((resolution) =>
        packages.has(resolution),
      ),
      true,
    );
  });

  it("reports the same duplicated packages as the default-settings fixture", () => {
    deepStrictEqual(
      Object.keys(duplicatesFor(dedupePeersScenario)).toSorted(),
      Object.keys(duplicatesFor(defaultScenario)).toSorted(),
    );
  });

  it("resolves dependents for every duplicate, so fixes can be identified", () => {
    const lock = lockFor(dedupePeersScenario);
    const duplicates = duplicatesFor(dedupePeersScenario);
    const packageNames = Object.keys(duplicates);
    const dependents = collectPnpmDependents(lock, packageNames);

    for (const name of packageNames) {
      ok(dependents.get(name)?.length, `expected dependents for ${name}`);
    }

    // identifyResolutionFixes throws on a missing dependent, which is what a
    // peer-suffix parsing regression would cause here.
    const fixes = buildIdentifiedFixesMap(duplicates, dependents);
    deepStrictEqual([...fixes.keys()].toSorted(), packageNames.toSorted());
  });
});

describe("dedupePeers with an identified fix", () => {
  it("flattens the peer suffixes of the pinned pair too", () => {
    ok(
      snapshotIds(mergeableDefaultScenario).some((id) => maxParenDepth(id) > 1),
    );
    deepStrictEqual(
      snapshotIds(mergeableDedupePeersScenario).filter(
        (id) => maxParenDepth(id) > 1,
      ),
      [],
    );
  });

  it("identifies the version every declared range accepts", () => {
    deepStrictEqual(
      fixesFor(mergeableDedupePeersScenario).get("printable-shell-command"),
      [
        {
          megeableResolutions: [
            "printable-shell-command@5.0.7",
            "printable-shell-command@5.3.1",
          ],
          to: "printable-shell-command@5.0.7",
        },
      ],
    );
  });

  it("identifies the same fixes as the default-settings fixture", () => {
    deepStrictEqual(
      [...fixesFor(mergeableDedupePeersScenario)],
      [...fixesFor(mergeableDefaultScenario)],
    );
  });
});
