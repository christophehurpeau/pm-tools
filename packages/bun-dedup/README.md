<h1 align="center">
  bun-dedup
</h1>

<p align="center">
  List duplicates and dedupe bun lock file
</p>

<p align="center">
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/v/bun-dedup.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/dw/bun-dedup.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/node/v/bun-dedup.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/types/bun-dedup.svg?style=flat-square" alt="types"></a>
</p>

## Usage

Requires `bun.lock` (the text lockfile, `bun install --save-text-lockfile` if
the project still has `bun.lockb`). Nothing needs to be installed: `bunx` fetches
the package, and `-p bun-dedup` is what tells it which one, since neither bin is
named after the package.

Installing it (`bun add -d bun-dedup`) is only worth it to pin a version — for a
CI gate, say. `bunx <bin>` then finds the local bin and the `-p` can be dropped.

Both bins may be run from any subdirectory of the project: they walk up to the
nearest `bun.lock` and operate on that project, naming the lockfile they found on
stderr when it is not the working directory.

### List duplicates, or explain one

```
bunx -p bun-dedup bun-why-duplicate                   # one line per duplicated package
bunx -p bun-dedup bun-why-duplicate --details         # every dependent, and the lockstep clusters
bunx -p bun-dedup bun-why-duplicate <dependencyName>  # explains the matching packages, detailed
bunx -p bun-dedup bun-why-duplicate <dependencyName> --all
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
bunx -p bun-dedup bun-dedupe              # apply
bunx -p bun-dedup bun-dedupe --dry-run    # print the plan, change nothing, exit 0
bunx -p bun-dedup bun-dedupe --check      # print the plan, change nothing, exit 1 if anything would change
```

`--check` is the CI gate; `--dry-run` (`-n`) is the same output without the
failing exit code.

Two passes run: the cluster pass edits `package.json` and runs `bun install`,
reaching versions the lockfile does not carry; the pure-lock pass then collapses
the leaves bun did not merge on its own. `--no-clusters` runs only the second.

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
`bun-why-duplicate` counts them.

### Progressive deduplication

Deduping the whole lockfile is the default: a run told nothing takes everything
it can. In case you only need to dedupe part of it, these flags bound a run to
the packages you name, and work on both commands:

```
bunx -p bun-dedup bun-dedupe --dry-run --scopes @babel        # one scope
bunx -p bun-dedup bun-dedupe --dry-run --packages 'lodash,@babel/**'  # names or globs
bunx -p bun-dedup bun-dedupe --dry-run --exclude lodash       # everything but these
bunx -p bun-dedup bun-dedupe --dry-run --exclude-scopes @types
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

`bun install` still runs during the cluster pass, and it may move entries the
filter did not select if it considers them stale.

Colors follow the terminal: `NO_COLOR` and a piped stdout turn them off,
`FORCE_COLOR` turns them on.

## Peer dependencies

`bun.lock` records a package's `dependencies` and nothing else, so a peer
requester is invisible here: `@babel/core` reads as unconstrained by the
`@babel/plugin-*` packages that peer-depend on it. This is a known gap — pinned
by name in `collectDependents.test.ts` — and it means a merge can be proposed
that a peer range would have argued against. `bun install` warns about an
unsatisfied peer, so a dedupe that goes too far shows up at install time.

The other two tools recover this differently: `pnpm-dedup` reads the peer range
from the manifest or the lockfile's own `packages:` entry, and
`yarn-berry-deduplicate` reads `peerDependencies` directly. Both mark such a
dependent with a dim `(peer)` in the report.

## Notes

- The cluster pass writes `overrides` in the workspace root `package.json` as
  scaffolding only: it re-resolves without them, and a fix that bun resolves back
  away from once the override is gone is reverted rather than applied. A dedupe
  that needs a standing override is not one this tool makes.
- The lockfile pass writes `bun.lock` as plain 2-space JSON, which is not
  byte-for-byte bun's own formatting. The run says so and suggests
  `bun update <something> && bun i` to have bun rewrite it in its own style.
- A rewritten lockfile is not an installed one: the run asks for `bun i` to bring
  `node_modules` in line with it.
- Non-npm resolutions (`workspace:`, git, tarball…) are parsed and reported but
  never merged: only semver-comparable npm versions are.
- This is the one package in the monorepo that runs on bun rather than node —
  the bins are `#!/usr/bin/env bun`, and the cluster pass shells out to `bun`.

## API

```js
import {
  fixDuplicates,
  listDuplicates,
  whyDuplicate,
} from "bun-dedup/src/index";

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
(`readAndParseBunLock`, `parseBunLockPackages`, `buildPackagesMap`,
`collectDependents`, `writeBunLockFile`), for building something else on top;
the algorithm itself lives in [pm-utils](../pm-utils).
