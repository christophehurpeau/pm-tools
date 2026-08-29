<h1 align="center">
  yarn-berry-deduplicate
</h1>

<p align="center">
  List duplicates and dedupe yarn berry lock file
</p>

<p align="center">
  <a href="https://npmjs.org/package/yarn-berry-deduplicate"><img src="https://img.shields.io/npm/v/yarn-berry-deduplicate.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/yarn-berry-deduplicate"><img src="https://img.shields.io/npm/dw/yarn-berry-deduplicate.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/yarn-berry-deduplicate"><img src="https://img.shields.io/node/v/yarn-berry-deduplicate.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/yarn-berry-deduplicate"><img src="https://img.shields.io/npm/types/yarn-berry-deduplicate.svg?style=flat-square" alt="types"></a>
</p>

## Usage

Requires yarn berry (>= 2). Nothing needs to be installed: `yarn dlx` fetches the
package. The dedupe bin carries the package's own name, so it runs bare; the
report bin does not, and `-p yarn-berry-deduplicate` is what tells `yarn dlx`
which package to fetch for it.

Installing it (`yarn add -D yarn-berry-deduplicate`) is only worth it to pin a
version — for a CI gate, say. `yarn exec <bin>` then runs the local one.

Both bins may be run from any subdirectory of the project: they walk up to the
nearest `yarn.lock` and operate on that project, naming the lockfile they found
on stderr when it is not the working directory.

### List duplicates, or explain one

```
yarn dlx -p yarn-berry-deduplicate yarn-berry-why-duplicate                   # one line per duplicated package
yarn dlx -p yarn-berry-deduplicate yarn-berry-why-duplicate --details         # every dependent, and the lockstep clusters
yarn dlx -p yarn-berry-deduplicate yarn-berry-why-duplicate <dependencyName>  # explains the matching packages, detailed
yarn dlx -p yarn-berry-deduplicate yarn-berry-why-duplicate <dependencyName> --all
```

`<dependencyName>` is a glob, so `@babel/*` works, and several may be named.
`--all` (`-a`) keeps packages that are not duplicated.

A named package that is not duplicated still gets its dependents listed —
"nothing found" is not an answer to "why is this duplicated". `--all` is only
needed to keep single-version matches next to duplicated ones.

By default the report is one line per duplicated package — the versions it
resolved to, and what it can be deduped to:

```
- @eslint/plugin-kit  resolved to 2 versions (0.7.1, 0.6.1)
- picomatch           resolved to 3 versions (4.0.4, 4.0.3, 2.3.1), can be deduped to 2 versions
```

`can be deduped to N versions` always means N remain, never N merged away.

`--details` (`-d`), implied when a package is named, files every dependent under
the version it resolved to, so the range that keeps each copy alive is read off
the version it sits under:

```
@eslint/plugin-kit — 2 versions
  0.7.1
    - check-package-dependencies  requires "^0.7.1"
    - eslint                      requires "^0.7.1"
  0.6.1
    - @eslint/json                requires "^0.6.1"
```

After the packages come the lockstep clusters — families published together,
whose duplicates only go away when the whole family moves. A package a cluster
converges carries the family's target and a `(cluster N)` reference.

The dedupable count is a floor: merging a package collapses its own dependency
edges too, so a run can remove copies no per-package fix predicted.

### Dedupe

```
yarn dlx yarn-berry-deduplicate              # apply
yarn dlx yarn-berry-deduplicate --dry-run    # print the plan, change nothing, exit 0
yarn dlx yarn-berry-deduplicate --check      # print the plan, change nothing, exit 1 if anything would change
```

`--check` is the CI gate; `--dry-run` (`-n`) is the same output without the
failing exit code.

Two passes run: the cluster pass edits `package.json` and runs `yarn install`,
reaching versions the lockfile does not carry; the pure-lock pass then collapses
the leaves yarn did not merge on its own, by merging descriptors onto one entry.
`--no-clusters` runs only the second.

The cluster pass writes `resolutions` in the workspace root `package.json` as
scaffolding only: it re-resolves without them, and a fix that yarn resolves back
away from once the resolution is gone is reverted rather than applied. A dedupe
that needs a standing `resolutions` entry is not one this tool makes.

A run that changes something ends with what it merged, one line per package:

```
Deduped 2 packages, 2 copies merged:
  barcode-detector: 2 versions (3.0.3, 3.2.2) -> 1 version (3.0.3)
  zxing-wasm:       2 versions (2.2.4, 3.1.3) -> 1 version (2.2.4)
No duplicate left.
```

Both passes are covered by that one summary. Both sides of a line are counted
and named, so a family converging onto an older release reads as two copies
becoming one rather than as a downgrade; a package only partly collapsed lists
the versions it still has. The last line counts the duplicates left, as
`yarn-berry-why-duplicate` counts them.

A rewritten lockfile is not an installed one: the run says `yarn.lock updated`
and asks for a `yarn install` to bring the project in line with it.

### Progressive deduplication

Deduping the whole lockfile is the default: a run told nothing takes everything
it can. In case you only need to dedupe part of it, these flags bound a run to
the packages you name, and work on both commands:

```
yarn dlx yarn-berry-deduplicate --dry-run --scopes @babel        # one scope
yarn dlx yarn-berry-deduplicate --dry-run --packages 'lodash,@babel/**'  # names or globs
yarn dlx yarn-berry-deduplicate --dry-run --exclude lodash       # everything but these
yarn dlx yarn-berry-deduplicate --dry-run --exclude-scopes @types
```

Each flag takes a comma list or is repeated (`--packages a --packages b`).
Selecting nothing selects everything. `--packages`/`--scopes` say what may be
touched; `--exclude`/`--exclude-scopes` win over them, so a scope can be taken
minus a few of its packages. Patterns are globs whose `*` stops at `/`, so
`@babel/*` matches `@babel/core` and a bare `*` matches only unscoped names.

A lockstep cluster moves as one, so a fix is kept only when the filter selects
every member of its family — otherwise it is skipped and the plan names the
members that blocked it. Widen the filter to take the family, or leave it for
another run.

`yarn install` still runs during the cluster pass, and it may move entries the
filter did not select if it considers them stale.

Colors follow the terminal: `NO_COLOR` and a piped stdout turn them off,
`FORCE_COLOR` turns them on.

## Peer dependencies

A `peerDependencies` range constrains its requester's resolved version exactly
as a dependency range does, and `yarn.lock` is where the _edge_ goes missing:
yarn folds a peer provision into the virtual package's `dependencies`, and
virtual packages are not written to the lockfile. So peer ranges sit in a block
of their own, with nothing saying who provided them.

Peer requesters are therefore read from `peerDependencies` directly, optional
ones included: whether a peer was actually provided cannot be told from the
lockfile, and a constraint that may not bind costs a suppressed merge, where a
missing one costs a merge that breaks a peer. Such a dependent is marked with a
dim `(peer)` after its range in the report.

A peer range never explains why a second version exists — yarn resolves peers
against what is already in the tree and warns instead of backtracking. It is an
extra constraint on a package duplicated for other reasons, which is why keeping
it changes the fixes.

Cluster membership is built from `dependencies` only. Adding peers there would
union unrelated packages into a family: `eslint-plugin-x@9.0.0` peer-depending on
`eslint@^9.0.0` is co-versioned by coincidence, not published in lockstep.

## Notes

- `nodeLinker` never reaches the lockfile. Resolution runs before linking, so
  `yarn.lock` is byte-identical under `pnp` and `node-modules`, and nothing here
  reads an installed tree — the same fixes apply either way.
- Non-npm protocols (`workspace:`, `patch:`, `portal:`, git…) are parsed and
  reported but never merged: only `npm:` resolutions are semver-comparable.
- The bins run on node (`>=22.18.0`), not on bun.

## API

```js
import {
  fixDuplicates,
  listDuplicates,
  whyDuplicate,
} from "yarn-berry-deduplicate";

listDuplicates({ details: true });
whyDuplicate({ filter: { include: ["@babel/*"] }, all: true, details: true });
fixDuplicates({
  mode: "dry-run",
  clusters: true,
  filter: { includeScopes: ["@babel"] },
});
```

`mode` is `"apply"`, `"dry-run"` or `"check"` — the same three the CLI exposes.
The lockfile parsing and graph building steps are exported too
(`readAndParseYarnLock`, `parseYarnLockPackages`, `buildYarnPackagesMap`,
`collectYarnDependents`, `toLockstepGraph`, `writeYarnLockFile`), for building
something else on top; the algorithm itself lives in [pm-utils](../pm-utils).
