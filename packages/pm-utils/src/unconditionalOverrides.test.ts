import { describe, expect, it } from "bun:test";
import type {
  ClusterExternalConstraint,
  ClusterFix,
  PlannedOverride,
} from "./index.ts";
import { partitionUnconditionalOverrides } from "./unconditionalOverrides.ts";

const constraint = (range: string): ClusterExternalConstraint => ({
  requester: "requester",
  requesterName: "requester",
  packageName: "lib",
  range,
});

const workspaceConstraint = (range: string): ClusterExternalConstraint => ({
  ...constraint(range),
  requester: "package.json in dependencies",
  requesterName: undefined,
});

// only `externalConstraints` is read; the rest is an empty cluster
const fixWith = (constraints: ClusterExternalConstraint[]): ClusterFix => ({
  members: ["lib"],
  duplicatedMembers: ["lib"],
  memberVersions: {},
  target: null,
  direction: "none",
  convergentMembers: [],
  driverMembers: [],
  excludedMembers: [],
  anchor: null,
  reuseFixes: [],
  floatingMembers: [],
  workspaceChanges: [],
  reResolutionSet: [],
  externalConstraints: constraints,
  needsRoundTrip: false,
  applicable: false,
});

const override: PlannedOverride = {
  packageName: "lib",
  version: "2.0.0",
  reason: "converge",
};

describe("partitionUnconditionalOverrides", () => {
  it("rejects an override a third-party range does not accept", () => {
    const { safe, rejected } = partitionUnconditionalOverrides(
      [fixWith([constraint("^1.0.0")])],
      [override],
    );

    expect(safe).toEqual([]);
    expect(rejected).toEqual([
      { override, rejectedBy: [constraint("^1.0.0")] },
    ]);
  });

  it("keeps an override every range accepts", () => {
    const { safe, rejected } = partitionUnconditionalOverrides(
      [fixWith([constraint("^2.0.0")])],
      [override],
    );

    expect(safe).toEqual([override]);
    expect(rejected).toEqual([]);
  });

  // `semver.satisfies` answers `false` for a range it cannot read rather than
  // throwing, so a selector naming something other than a version — which says
  // nothing about the version at all — would otherwise reject every override.
  it("keeps an override against a selector semver cannot read", () => {
    const { safe, rejected } = partitionUnconditionalOverrides(
      [
        fixWith([
          constraint("workspace:*"),
          constraint("git+ssh://git@host/r.git#v1"),
          constraint("catalog:default"),
        ]),
      ],
      [override],
    );

    expect(safe).toEqual([override]);
    expect(rejected).toEqual([]);
  });

  // A workspace range belongs to the user, who is the one asking for the dedupe.
  it("ignores a workspace constraint", () => {
    const { safe } = partitionUnconditionalOverrides(
      [fixWith([workspaceConstraint("^1.0.0")])],
      [override],
    );

    expect(safe).toEqual([override]);
  });
});
