<h1 align="center">
  pnpm-dedup
</h1>

<p align="center">
  List duplicates and dedupe pnpm lock file
</p>

<p align="center">
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/v/pnpm-dedup.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/dw/pnpm-dedup.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/node/v/pnpm-dedup.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/types/pnpm-dedup.svg?style=flat-square" alt="types"></a>
</p>

## Usage

Nothing needs to be installed: `pnpm dlx` fetches the package, and
`--package pnpm-dedup` is what tells it which one, since `pnpm dlx` otherwise
fetches the package whose name matches the command. The bins are
`pnpm-why-duplicate` and `pnpm-dedupe`, plus `pnpm-dedup` as an alias of the
latter — that one does match the package name, so `pnpm dlx pnpm-dedup` is a
shorter way to run the dedupe.

Installing it (`pnpm add -D pnpm-dedup`) is only worth it to pin a version — for
a CI gate, say. `pnpm exec <bin>` then runs the local one.

Both bins may be run from any subdirectory of the project: they walk up to the
nearest `pnpm-lock.yaml` and operate on that project, naming the lockfile they
found on stderr when it is not the working directory.

### List duplicates, or explain one

```
pnpm dlx --package pnpm-dedup pnpm-why-duplicate                   # one line per duplicated package
pnpm dlx --package pnpm-dedup pnpm-why-duplicate --details         # every dependent, and the lockstep clusters
pnpm dlx --package pnpm-dedup pnpm-why-duplicate <dependencyName>  # explains the matching packages, detailed
pnpm dlx --package pnpm-dedup pnpm-why-duplicate <dependencyName> --all
```

`<dependencyName>` is a glob, so `@babel/*` works. `--all` (`-a`) keeps packages
that are not duplicated.

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
pnpm dlx --package pnpm-dedup pnpm-dedupe              # apply
pnpm dlx --package pnpm-dedup pnpm-dedupe --dry-run    # print the plan, change nothing, exit 0
pnpm dlx --package pnpm-dedup pnpm-dedupe --check      # print the plan, change nothing, exit 1 if anything would change
```

`--check` is the CI gate; `--dry-run` (`-n`) is the same output without the
failing exit code. `--check` also exits 1 when `pnpm dedupe --check` itself
cannot confirm the lockfile is settled, so a probe that fails for environmental
reasons fails the gate rather than passing silently.

`--no-convergence-overrides` writes plain overrides instead of convergence ones,
which pnpm applies to every requester whatever range it declares. Convergence
overrides need pnpm >= 11.13.0; without them the cluster pass is skipped.

A run that changes something ends with what it merged, one line per package:

```
Deduped 2 packages, 2 copies merged:
  barcode-detector: 2 versions (3.0.3, 3.2.2) -> 1 version (3.0.3)
  zxing-wasm:       2 versions (2.2.4, 3.1.3) -> 1 version (2.2.4)
No duplicate left.
```

The cluster pass and `pnpm dedupe` are covered by that one summary. Both sides
of a line are counted and named, so a family converging onto an older release
reads as two copies becoming one rather than as a downgrade; a package only
partly collapsed lists the versions it still has. The last line counts the
duplicates left, as `pnpm-why-duplicate` counts them.

### Progressive deduplication

Deduping the whole lockfile is the default: a run told nothing takes everything
it can. In case you only need to dedupe part of it, these flags bound a run to
the packages you name, and work on both commands:

```
pnpm dlx --package pnpm-dedup pnpm-dedupe --dry-run --scopes @babel        # one scope
pnpm dlx --package pnpm-dedup pnpm-dedupe --dry-run --packages 'lodash,@babel/**'  # names or globs
pnpm dlx --package pnpm-dedup pnpm-dedupe --dry-run --exclude lodash       # everything but these
pnpm dlx --package pnpm-dedup pnpm-dedupe --dry-run --exclude-scopes @types
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

A filtered run does not end with `pnpm dedupe`, which knows nothing of the
filter and would merge everything it can. It says so instead, so you can run it
yourself when you are ready. Applying still needs a real resolution — an
override only takes effect through one — so a filtered run that changes
something has already let pnpm merge what it could reach on its own; a
`--dry-run` or `--check` runs nothing at all.

Colors follow the terminal: `NO_COLOR` and a piped stdout turn them off,
`FORCE_COLOR` turns them on.

## Two passes, one of them pnpm's

`pnpm dedupe` merges what it can resolve to a single version on its own, but it
never widens a workspace range and never repoints an edge that resolved past a
version the family already carries. That gap is what the cluster pass covers, so
it runs first and `pnpm dedupe` finishes the residuals. Unlike the bun and yarn
tools, there is no lockfile-rewriting pass here: `pnpm-lock.yaml` is only ever
written by pnpm itself.

The cluster pass edits workspace `package.json` ranges and adds overrides to
`pnpm-workspace.yaml`, then re-resolves without them: overrides are scaffolding,
and a fix that holds on its own has them removed again.

When a fix does _not_ hold — `pnpm dedupe` resolves the duplicate straight back
once the override is gone — the override stays, with a comment above it saying
so and pointing at the issue tracker, and the run reports how many were left.
That is the one case where this tool leaves something standing in your
configuration; it is a workaround, and the cluster is worth reporting.

Convergence overrides (`"pkg@": "1.2.3"`, an empty range selector) are what make
this safe: they rewrite an edge only when the declared range accepts that exact
version, so a third-party range that legitimately pins elsewhere is left alone.
`--no-convergence-overrides` falls back to plain overrides, which force every
requester regardless.

## Peer dependencies

pnpm resolves peers before writing the lockfile, folds each into the snapshot's
`dependencies` and encodes the context in the peer-suffixed key. So the _edge_
survives — and an edge that exists means the peer really was provided — but the
_range_ does not: the snapshot stores the resolved version.

Left at that, 17 eslint plugins declaring `eslint: "^8.57.0 || ^9.0.0"` would all
read as exact pins of whatever got installed, and nothing could be merged. The
range is therefore recovered from the installed manifest first, then from the
lockfile's own `packages:` entry, so it survives with no `node_modules` present.
Such a dependent is marked with a dim `(peer)` after its range in the report.

A peer range never explains why a second version exists — pnpm resolves peers
against what is in the tree and warns instead of backtracking, and the several
peer-suffixed keys of one version are several _installations_, folded back into a
single resolution here. It is an extra constraint on a package duplicated for
other reasons, which is why recovering it changes the fixes.

## Notes

- Requires pnpm on `PATH`. Cluster fixes additionally need pnpm >= 11.13.0; below
  that the pass is skipped with a message, and `pnpm dedupe` still runs.
- `--check` shells out to `pnpm dedupe --check`, so it fails the gate when that
  probe cannot confirm the lockfile is settled — an environmental failure fails
  loudly rather than passing silently.
- Non-npm resolutions (`link:`, git, tarball…) are parsed and reported but never
  merged: only semver-comparable npm versions are.
- Node only (`>=22.18.0`), no bun runtime dependency, despite the monorepo being
  developed with bun.

## API

```js
import { dedupe, listDuplicates, whyDuplicate } from "pnpm-dedup/src/index";

listDuplicates({ details: true });
whyDuplicate({ filter: { include: ["@babel/*"] }, all: true, details: true });
dedupe({
  mode: "dry-run",
  convergenceOverrides: true,
  filter: { includeScopes: ["@babel"] },
});
```

`mode` is `"apply"`, `"dry-run"` or `"check"` — the same three the CLI exposes.
The lockfile parsing and graph building steps are exported too (`readPnpmLock`,
`parsePnpmLockPackages`, `buildPnpmPackagesMap`, `collectPnpmDependents`,
`collectDependentRanges`, `toLockstepGraph`), for building something else on
top; the algorithm itself lives in [pm-utils](../pm-utils).
