<h1 align="center">
  pm-utils
</h1>

<p align="center">
  package manager utils
</p>

<p align="center">
  <a href="https://npmjs.org/package/pm-utils"><img src="https://img.shields.io/npm/v/pm-utils.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/pm-utils"><img src="https://img.shields.io/npm/dw/pm-utils.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/pm-utils"><img src="https://img.shields.io/node/v/pm-utils.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/pm-utils"><img src="https://img.shields.io/npm/types/pm-utils.svg?style=flat-square" alt="types"></a>
</p>

## Install

```bash
npm install --save pm-utils
```

## Usage

The package-manager-agnostic core behind
[bun-dedup](../bun-dedup), [pnpm-dedup](../pnpm-dedup) and
[yarn-berry-deduplicate](../yarn-berry-deduplicate): everything about finding
duplicates, deciding what can be merged and rendering the result lives here.
The per-manager packages only parse their lockfile into the shapes below and
write the result back.

It is published so those packages can depend on it, not as a general-purpose
library: this is internal API and it changes with them. There is no default
export — import the named ones.

```js
import {
  buildLockstepClusters,
  createPackageFilter,
  findProjectRoot,
  identifyResolutionFixes,
} from "pm-utils";

const projectDir = findProjectRoot({ lockfileName: "bun.lock" }); // null when there is none
const filter = createPackageFilter({
  includeScopes: ["@babel"],
  exclude: ["@babel/runtime"],
});

filter.selects("@babel/core"); // true
filter.rejectionReason("lodash"); // why it is left alone, for the report
```

### What a package manager has to supply

The core never touches the filesystem for you and never guesses a lockfile path.
A caller reads its own lockfile and hands over:

- a **resolutions** list — one entry per resolved copy of a package
  (`ResolutionEntry`, whose `package` is `npm` or another protocol).
- a **dependents map** — for each package name, who requires it and with which
  range (`ResolutionDependentsMap`). This is where the managers differ most:
  see the peer-dependency notes in each package's README.
- for the cluster pass, a **lockstep graph** (`LockstepGraph`), the dependency
  edges between resolved copies.

### Areas

| Area               | Exports                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project root       | `findProjectRoot`, `resolveProjectDir`                                                                                                              |
| CLI grammar        | `parseBinArgs`, `packageFilterParseArgsOptions`, `packageFilterUsage`, `whyDuplicateParseArgsOptions`, `whyDuplicateUsage`, `toWhyDuplicateRequest` |
| Package filtering  | `createPackageFilter`, `selectPackages`, `selectClusterFixes`, `describeSkippedClusterFix`, `selectExplainedPackages`                               |
| Names and ranges   | `PackageDescriptorNameUtils`, `PackageDependencyDescriptorUtils`, `isNpmProtocol`, `isSemverComparable`, `createCandidateVersionComparator`         |
| Fix identification | `identifyResolutionFixes`, `buildLockstepClusters`, `identifyLockstepClusterFixes`, `buildIdentifiedFixesMap`, `clusterLabel`                       |
| Applying           | `planClusterApply`, `applyWorkspaceRangeEdit`, `nextSelector`, `partitionUnconditionalOverrides`, `captureFiles`, `restoreFiles`                    |
| Measuring a run    | `buildVersionsSnapshot`, `diffVersionsSnapshots`, `countDuplicatedPackages`, `diffDuplicates`                                                       |
| Rendering          | `renderDuplicatesReport`, `renderApplyPlan`, `renderDedupeSummary`, `createColorize`, `shouldColorize`, `stylePackageName`, `stylePackageReference` |

Two of these carry most of the behaviour:

- **`identifyResolutionFixes`** finds the merges reachable one package at a
  time: a copy whose dependents' ranges all accept a version already in the
  lockfile. This is what the lockfile pass applies.
- **`identifyLockstepClusterFixes`** finds the rest. `buildLockstepClusters`
  groups packages that are always published at the same version, and a
  duplicate inside such a family only goes away when the whole family moves —
  which needs a real resolution, hence the separate cluster pass.

`resolveProjectDir` is the bin-facing half of `findProjectRoot`: it prints the
reason and sets `process.exitCode` when there is no lockfile, and returns
`null`, so callers guard with `if (projectDir === null) return;`. The notice
naming the lockfile goes to stderr and only when the root is not the working
directory, keeping a redirected report parseable.

### Colors

`shouldColorize(stream)` follows the terminal: `NO_COLOR` and a piped stream turn
colors off, `FORCE_COLOR` turns them on. Every renderer takes the resulting
`Colorize`, so a report piped to a file is plain text.

### Runtime

Node only (`>=22.18.0`), so the pnpm and yarn tools can depend on it: no
`Bun.*`, no `bun` imports. Tests run under `bun test` like the rest of the
monorepo.
