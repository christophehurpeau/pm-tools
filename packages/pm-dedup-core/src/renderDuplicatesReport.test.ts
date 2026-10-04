import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import type { ClusterFix } from "./identifyLockstepClusterFixes.ts";
import { renderDuplicatesReport } from "./renderDuplicatesReport.ts";
import type {
  DuplicatePackageView,
  DuplicatesReportOptions,
} from "./renderDuplicatesReport.ts";

const escapeStart = "\u001B[";
// eslint-disable-next-line no-control-regex
const escapePattern = /\u001B\[[\d;]+m/gu;

const metroPin = {
  requester: "package.json in devDependencies",
  requesterName: undefined,
  packageName: "metro",
  range: "0.84.5",
};

const clusterFix = (overrides: Partial<ClusterFix> = {}): ClusterFix => ({
  members: ["metro", "metro-config"],
  duplicatedMembers: ["metro", "metro-config"],
  memberVersions: {
    metro: { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
    "metro-config": { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
  },
  target: "0.87.0",
  direction: "up",
  convergentMembers: ["metro", "metro-config"],
  driverMembers: ["metro"],
  excludedMembers: [],
  anchor: null,
  reuseFixes: [],
  floatingMembers: [],
  workspaceChanges: [],
  reResolutionSet: ["metro"],
  externalConstraints: [metroPin],
  needsRoundTrip: true,
  applicable: true,
  ...overrides,
});

const metroPackage = (
  overrides: Partial<DuplicatePackageView> = {},
): DuplicatePackageView => ({
  packageName: "metro",
  resolutions: [
    {
      resolution: "metro@0.84.5",
      version: "0.84.5",
      installations: ["metro@0.84.5"],
    },
    {
      resolution: "metro@0.87.0",
      version: "0.87.0",
      installations: ["metro@0.87.0"],
    },
  ],
  dependents: [
    {
      requester: "package.json in devDependencies",
      range: "0.84.5",
      resolvedVersion: "0.84.5",
    },
  ],
  dedupe: [],
  ...overrides,
});

// the tree is what the cluster sections live in; the one-line form has its own
// helper below
const render = (overrides: Partial<DuplicatesReportOptions> = {}): string => {
  let buffer = "";
  renderDuplicatesReport({
    title: "duplicates",
    packages: [metroPackage()],
    totalDependencies: 120,
    dedupeCommand: "pnpm-dedupe",
    whyCommand: "pnpm-why-duplicate",
    details: true,
    color: false,
    log: (message = "") => {
      buffer += `${message}\n`;
    },
    ...overrides,
  });
  return buffer;
};

const renderSummary = (
  overrides: Partial<DuplicatesReportOptions> = {},
): string => render({ details: false, ...overrides });

const lastLine = (output: string): string =>
  output.trimEnd().split("\n").at(-1)!;

describe("renderDuplicatesReport", () => {
  it("groups every dependent under the version it resolved to", () => {
    const output = render();
    ok(output.startsWith("Found 1 duplicate:\n"));
    ok(output.includes("metro — 2 versions"));
    // highest first, so the version a merge usually targets leads
    ok(output.indexOf("  0.87.0") < output.indexOf("  0.84.5"));
    ok(
      output.includes(
        '    - package.json in devDependencies  requires "0.84.5"',
      ),
    );
  });

  it("says when nothing declares a version through a comparable range", () => {
    ok(render().includes("    (no semver range recorded for it)"));
  });

  it("files a dependent under the versionless resolution it names", () => {
    const output = render({
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.87.0",
              version: "0.87.0",
              installations: ["metro@0.87.0"],
            },
            {
              resolution: "metro@patch:metro@npm%3A0.87.0#./p.patch",
              installations: ["metro@patch:metro@npm%3A0.87.0#./p.patch"],
            },
          ],
          dependents: [
            {
              requester: "package.json in devDependencies",
              range: "^0.87.0",
              resolvedVersion: "0.87.0",
            },
            {
              requester: "needs-patch@1.0.0",
              range: "patch:metro@npm%3A0.87.0#./p.patch",
              resolvedResolution: "metro@patch:metro@npm%3A0.87.0#./p.patch",
            },
          ],
        }),
      ],
    });
    ok(!output.includes("(no semver range recorded for it)"));
    ok(!output.includes("(resolved version unknown)"));
    ok(
      output.indexOf("  metro@patch:metro@npm%3A0.87.0#./p.patch") <
        output.indexOf("- needs-patch@1.0.0"),
    );
  });

  // a resolution the report does not carry cannot be guessed at as the sole
  // version: whoever declared it is not holding that copy
  it("leaves a dependent naming an unknown resolution unattributed", () => {
    const output = render({
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.84.5",
              version: "0.84.5",
              installations: ["metro@0.84.5"],
            },
          ],
          dependents: [
            {
              requester: "needs-patch@1.0.0",
              range: "patch:metro@npm%3A0.87.0#./p.patch",
              resolvedResolution: "metro@patch:metro@npm%3A0.87.0#./p.patch",
            },
          ],
        }),
      ],
    });
    ok(output.includes("  (resolved version unknown)"));
  });

  it("lists a dependent whose resolved version is unknown rather than dropping it", () => {
    const output = render({
      packages: [
        metroPackage({
          dependents: [{ requester: "mini-deep@2.0.0", range: "^0.84.0" }],
        }),
      ],
    });
    ok(output.includes("  (resolved version unknown)"));
    ok(output.includes('    - mini-deep@2.0.0  requires "^0.84.0"'));
  });

  it("attributes an unresolved dependent to the sole version", () => {
    const output = render({
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.84.5",
              version: "0.84.5",
              installations: ["metro@0.84.5"],
            },
          ],
          dependents: [
            {
              requester: "package.json in devDependencies",
              range: "0.84.5",
              resolvedVersion: "0.84.5",
            },
            // a peer range carries no resolved version of its own, and one
            // version in the lockfile leaves nothing to attribute
            { requester: "mini-deep@2.0.0", range: "^0.84.0", peer: true },
            // not even when the sole version does not satisfy it: an unmet peer
            // is a warning, not a second copy
            { requester: "old-deep@1.0.0", range: "^0.74.0", peer: true },
          ],
        }),
      ],
    });
    ok(!output.includes("(resolved version unknown)"));
    ok(output.indexOf("  0.84.5") < output.indexOf("- mini-deep@2.0.0"));
    ok(
      output.includes(
        '    - mini-deep@2.0.0                  requires "^0.84.0" (peer)',
      ),
    );
    ok(
      output.includes(
        '    - old-deep@1.0.0                   requires "^0.74.0" (peer)',
      ),
    );
  });

  it("lists the installation contexts of a shared resolution", () => {
    const output = render({
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.84.5",
              version: "0.84.5",
              installations: ["metro@0.84.5", "metro@0.84.5(react@19)"],
            },
          ],
        }),
      ],
    });
    ok(
      output.includes("    installed at: metro@0.84.5, metro@0.84.5(react@19)"),
    );
  });

  it("states how a duplicate would collapse", () => {
    const output = render({
      packages: [
        metroPackage({
          dedupe: [{ from: ["0.84.5"], to: "0.87.0", direction: "up" }],
        }),
      ],
    });
    ok(
      output.includes("metro — 2 versions, can be deduped to 0.87.0 (upgrade)"),
    );
    ok(output.includes("  0.84.5  can be deduped to 0.87.0 (upgrade)"));
  });

  it("counts the versions left when only some of them merge", () => {
    const output = render({
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.87.0",
              version: "0.87.0",
              installations: ["metro@0.87.0"],
            },
            {
              resolution: "metro@0.84.5",
              version: "0.84.5",
              installations: ["metro@0.84.5"],
            },
            {
              resolution: "metro@0.74.1",
              version: "0.74.1",
              installations: ["metro@0.74.1"],
            },
          ],
          dedupe: [{ from: ["0.84.5"], to: "0.87.0", direction: "up" }],
        }),
      ],
    });
    // three resolved, one merges away: two remain — never "one merged"
    ok(output.includes("metro — 3 versions, can be deduped to 2 versions"));
  });

  it("reports no duplicates for an empty list", () => {
    const output = render({ packages: [] });
    ok(output.startsWith("No duplicates found\n"));
    strictEqual(
      lastLine(output),
      "Found 120 dependencies, 0 duplicates, 0 dedupable.",
    );
  });

  it("leads with the notice instead of a count that would read as no report", () => {
    const output = render({
      title: "matches",
      notice: "lodash is not duplicated. Showing its dependents:",
      packages: [
        metroPackage({
          packageName: "lodash",
          resolutions: [
            {
              resolution: "lodash@4.17.21",
              version: "4.17.21",
              installations: ["lodash@4.17.21"],
            },
          ],
          dependents: [
            {
              requester: "eslint@9.0.0",
              range: "^4.17.0",
              resolvedVersion: "4.17.21",
            },
          ],
        }),
      ],
    });
    ok(
      output.startsWith("lodash is not duplicated. Showing its dependents:\n"),
    );
    ok(!output.includes("No duplicates found"));
    ok(output.includes('    - eslint@9.0.0  requires "^4.17.0"'));
    strictEqual(
      lastLine(output),
      "Found 120 dependencies, 1 match, 0 dedupable.",
    );
  });

  it("omits the command when nothing is dedupable", () => {
    ok(!render().includes("pnpm-dedupe"));
  });

  it("credits a cluster for a package its own resolutions cannot fix", () => {
    const output = render({ clusterFixes: [clusterFix()] });
    ok(
      output.includes("metro — 2 versions, can be deduped to 0.87.0 (upgrade)"),
    );
    strictEqual(
      lastLine(output),
      "Found 120 dependencies, 1 duplicate, at least 1 dedupable (deduping may remove more). Run `pnpm-dedupe` to apply.",
    );
  });

  it("counts a package that is both its own fix and a cluster member once", () => {
    const output = render({
      packages: [
        metroPackage({ dedupe: [{ from: ["0.84.5"], to: "0.87.0" }] }),
      ],
      clusterFixes: [clusterFix()],
    });
    ok(lastLine(output).includes("at least 1 dedupable"));
  });

  // A merged package drags its own dependency edges along, so the count is a
  // floor and has to read like one.
  it("words the dedupable count as a floor", () => {
    ok(
      render({ clusterFixes: [clusterFix()] }).includes(
        "at least 1 dedupable (deduping may remove more)",
      ),
    );
  });

  it("explains what a cluster is, once", () => {
    const output = render({ clusterFixes: [clusterFix(), clusterFix()] });
    ok(output.includes("Lockstep clusters:"));
    strictEqual(
      output.split("A lockstep cluster is a family of packages").length - 1,
      1,
    );
  });

  it("cross-references a member to its cluster", () => {
    const output = render({ clusterFixes: [clusterFix()] });
    ok(output.includes("(cluster 1)"));
    ok(
      output.includes(
        "cluster 1 — metro* [2 packages, 2 duplicated, 2 fixable]:",
      ),
    );
  });

  it("lists every member with its installed versions", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          members: ["metro", "metro-config-with-a-long-name"],
          memberVersions: {
            metro: { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
            "metro-config-with-a-long-name": {
              versions: ["0.87.0"],
              nonNpmCount: 0,
            },
          },
        }),
      ],
    });
    ok(output.includes("  Members:"));
    // aligned on the longest member name
    ok(output.includes("    - metro                          0.84.5, 0.87.0"));
    ok(output.includes("    - metro-config-with-a-long-name  0.87.0"));
  });

  it("says when a member also has non-npm resolutions", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          memberVersions: {
            metro: { versions: ["0.84.5"], nonNpmCount: 1 },
            "metro-config": { versions: ["0.84.5", "0.87.0"], nonNpmCount: 0 },
          },
        }),
      ],
    });
    ok(output.includes("0.84.5 (+1 non-npm)"));
  });

  it("renders the target, the drivers and the members that follow", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          members: ["metro", "metro-config", "metro-core"],
          convergentMembers: ["metro", "metro-config", "metro-core"],
          driverMembers: ["metro"],
        }),
      ],
    });
    ok(output.includes("  Dedupe: 0.87.0 (upgrade)"));
    ok(output.includes("    Driven by: metro (2 members follow)"));
  });

  it("uses the singular when one member follows", () => {
    ok(render({ clusterFixes: [clusterFix()] }).includes("(1 member follows)"));
  });

  it("names the members whose version the resolver picks", () => {
    const output = render({
      clusterFixes: [clusterFix({ floatingMembers: ["metro-config"] })],
    });
    ok(output.includes("    Resolver picks: metro-config"));
  });

  it("has no Dedupe section for an unfixable cluster", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          target: null,
          direction: "none",
          applicable: false,
          convergentMembers: [],
          driverMembers: [],
          reResolutionSet: [],
        }),
      ],
    });
    ok(output.includes("[2 packages, 2 duplicated, 0 fixable]:"));
    ok(!output.includes("Dedupe:"));
    ok(lastLine(output).includes("0 dedupable"));
  });

  it("renders the duplicates an excluded member keeps", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          convergentMembers: ["metro"],
          excludedMembers: [
            {
              packageName: "metro-config",
              blockedBy: [
                {
                  requester: "react-native-web@0.21.2",
                  requesterName: "react-native-web",
                  packageName: "metro-config",
                  range: "^0.74.1",
                },
              ],
            },
          ],
        }),
      ],
    });
    ok(output.includes("  Remaining duplicates:"));
    ok(
      output.includes(
        '    - metro-config: react-native-web requires "^0.74.1"',
      ),
    );
  });

  it("renders open ranges that did not reuse the anchored version", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          anchor: "0.84.5",
          reuseFixes: [
            {
              requester: "mini-deep@2.0.0",
              requesterName: "mini-deep",
              packageName: "metro-config",
              range: "*",
              from: "0.87.0",
              to: "0.84.5",
            },
          ],
        }),
      ],
    });
    ok(output.includes("  Open ranges not reusing the pinned 0.84.5:"));
    ok(
      output.includes(
        '    - mini-deep requires metro-config "*", resolved 0.87.0 -> would pin 0.84.5',
      ),
    );
  });

  it("renders open ranges even when the cluster cannot be fixed", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          applicable: false,
          target: null,
          convergentMembers: [],
          anchor: "0.84.5",
          reuseFixes: [
            {
              requester: "mini-deep@2.0.0",
              requesterName: "mini-deep",
              packageName: "metro-config",
              range: "*",
              from: "0.87.0",
              to: "0.84.5",
            },
          ],
        }),
      ],
    });
    ok(output.includes("Open ranges not reusing the pinned 0.84.5:"));
  });

  it("files an external range under the version it resolved to", () => {
    const output = render({
      clusterFixes: [
        clusterFix({
          externalConstraints: [
            { ...metroPin, resolvedVersion: "0.84.5" },
            {
              requester: "react-native-web@0.21.2",
              requesterName: "react-native-web",
              packageName: "metro-config",
              range: "^0.74.1",
            },
          ],
        }),
      ],
    });
    ok(output.includes("  Resolutions (external):"));
    ok(output.includes("    0.84.5"));
    ok(output.includes('      - workspace         requires metro "0.84.5"'));
    // nothing records what this one got, and it is not dropped for it
    ok(output.includes("    (resolved version unknown)"));
    ok(
      output.includes(
        '      - react-native-web  requires metro-config "^0.74.1"',
      ),
    );
  });

  it("attributes a workspace constraint to the workspace", () => {
    const output = render({ clusterFixes: [clusterFix()] });
    ok(output.includes("  Resolutions (external):"));
    ok(output.includes('- workspace  requires metro "0.84.5"'));
  });

  it("skips a cluster with no duplicated member", () => {
    const output = render({
      clusterFixes: [clusterFix({ duplicatedMembers: [] })],
    });
    ok(!output.includes("Lockstep clusters:"));
    ok(!output.includes("(cluster 1)"));
  });

  it("titles the report for a match listing", () => {
    ok(render({ title: "matches" }).startsWith("Found 1 match:\n"));
  });

  it("gives each package one line, with its census and its verdict", () => {
    const output = renderSummary({
      packages: [
        metroPackage({
          dedupe: [{ from: ["0.84.5"], to: "0.87.0", direction: "up" }],
        }),
      ],
    });
    ok(
      output.includes(
        "- metro  resolved to 2 versions (0.87.0, 0.84.5), can be deduped to 0.87.0 (upgrade)",
      ),
    );
  });

  it("leaves the verdict off a package nothing can collapse", () => {
    const output = renderSummary();
    ok(output.includes("- metro  resolved to 2 versions (0.87.0, 0.84.5)"));
    ok(!output.includes("can be deduped"));
  });

  it("keeps no tree and no cluster section", () => {
    const output = renderSummary({ clusterFixes: [clusterFix()] });
    ok(!output.includes("Lockstep clusters:"));
    ok(!output.includes('requires "0.84.5"'));
  });

  it("points at the tree", () => {
    ok(
      renderSummary().includes(
        "Run `pnpm-why-duplicate --details` to see every dependent.",
      ),
    );
    ok(!render().includes("--details"));
  });

  // one version installed several times is a duplicate the census cannot show
  it("names the install paths of a package resolved once", () => {
    const output = renderSummary({
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.84.5",
              version: "0.84.5",
              installations: ["metro@0.84.5", "metro@0.84.5(react@19)"],
            },
          ],
        }),
      ],
    });
    ok(
      output.includes(
        "- metro  resolved to 1 version (0.84.5) installed at 2 paths",
      ),
    );
  });

  it("styles without moving anything: stripped, the two renders match", () => {
    const options: Partial<DuplicatesReportOptions> = {
      packages: [
        metroPackage({
          resolutions: [
            {
              resolution: "metro@0.84.5",
              version: "0.84.5",
              installations: ["metro@0.84.5", "metro@0.84.5(react@19)"],
            },
          ],
          dedupe: [{ from: ["0.84.5"], to: "0.87.0" }],
        }),
      ],
      clusterFixes: [
        clusterFix({
          members: ["@react-native/metro-config", "metro-config-long-name"],
          memberVersions: {
            "@react-native/metro-config": {
              versions: ["0.84.5"],
              nonNpmCount: 1,
            },
            "metro-config-long-name": {
              versions: ["0.84.5", "0.87.0"],
              nonNpmCount: 0,
            },
          },
          floatingMembers: ["metro-config-long-name"],
          anchor: "0.84.5",
          reuseFixes: [
            {
              requester: "mini-deep@2.0.0",
              requesterName: "mini-deep",
              packageName: "metro-config",
              range: "*",
              from: "0.87.0",
              to: "0.84.5",
            },
          ],
          excludedMembers: [
            {
              packageName: "@react-native/metro-config",
              blockedBy: [
                {
                  requester: "react-native-web@0.21.2",
                  requesterName: "react-native-web",
                  packageName: "@react-native/metro-config",
                  range: "^0.74.1",
                },
              ],
            },
          ],
        }),
      ],
    };
    const stripped = render({ ...options, color: true }).replaceAll(
      escapePattern,
      "",
    );
    strictEqual(stripped, render(options));
  });

  it("emits no escape codes with color off, and some with it on", () => {
    ok(!render({ clusterFixes: [clusterFix()] }).includes(escapeStart));
    ok(
      render({ color: true, clusterFixes: [clusterFix()] }).includes(
        escapeStart,
      ),
    );
  });
});
