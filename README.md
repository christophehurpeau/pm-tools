<h1 align="center">
  pm-tools
</h1>

<p align="center">
  Find out why a dependency is duplicated in a lockfile, and dedupe it.
</p>

<h3>📦 Packages</h3>

This repository is a monorepo that we manage using [Yarn Workspaces](https://yarnpkg.com/features/workspaces).

| Package                                                   | Version                                                                                                                                              | Description                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [bun-dedup](packages/bun-dedup)                           | <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/v/bun-dedup.svg?style=flat-square"></a>                           | Simple bin to know why a package is duplicated  |
| [pm-utils](packages/pm-utils)                             | <a href="https://npmjs.org/package/pm-utils"><img src="https://img.shields.io/npm/v/pm-utils.svg?style=flat-square"></a>                             | package manager utils                           |
| [yarn-why-duplicate](packages/yarn-why-duplicate)         | <a href="https://npmjs.org/package/yarn-why-duplicate"><img src="https://img.shields.io/npm/v/yarn-why-duplicate.svg?style=flat-square"></a>         | Simple bin to know why a package is duplicated  |
| [pnpm-dedup](packages/pnpm-dedup)                         | <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/v/pnpm-dedup.svg?style=flat-square"></a>                         | List duplicates and dedupe pnpm lock file       |
| [yarn-berry-deduplicate](packages/yarn-berry-deduplicate) | <a href="https://npmjs.org/package/yarn-berry-deduplicate"><img src="https://img.shields.io/npm/v/yarn-berry-deduplicate.svg?style=flat-square"></a> | List duplicates and dedupe yarn berry lock file |

Every tool here answers the same two questions, for a different package manager:

- **why is this duplicated?** — which dependents force a package to resolve to
  several versions, and which of those copies could be merged.
- **dedupe it** — compute the fixes (narrowing workspace ranges, adding
  transient overrides, rewriting the lockfile) and apply them.

An apply run acts as it goes and reports what it merged once the lockfile has
settled. `--dry-run` prints the plan and changes nothing; `--check` does the same
and exits 1 if anything would change, which is the CI gate.

<h3>🚀 Which command</h3>

| Lockfile          | Package                  | Report                     | Dedupe                   |
| ----------------- | ------------------------ | -------------------------- | ------------------------ |
| `bun.lock`        | `bun-dedup`              | `bun-why-duplicate`        | `bun-dedupe`             |
| `pnpm-lock.yaml`  | `pnpm-dedup`             | `pnpm-why-duplicate`       | `pnpm-dedupe`            |
| `yarn.lock` (v2+) | `yarn-berry-deduplicate` | `yarn-berry-why-duplicate` | `yarn-berry-deduplicate` |

Nothing to install — run them straight from the registry. The bin names differ
from the package name, so the package to fetch is named explicitly:

```sh
bunx -p bun-dedup bun-why-duplicate                # what is duplicated, and what can be merged
bunx -p bun-dedup bun-why-duplicate '@babel/*'     # why these are duplicated, in detail
bunx -p bun-dedup bun-dedupe --dry-run             # the plan, changing nothing
bunx -p bun-dedup bun-dedupe                       # apply it
```

The other two are the same with their own runner and package:
`pnpm dlx --package pnpm-dedup pnpm-why-duplicate`,
`yarn dlx -p yarn-berry-deduplicate yarn-berry-why-duplicate`. Two commands match
their package name and need no flag: `pnpm dlx pnpm-dedup` and
`yarn dlx yarn-berry-deduplicate`.

Installing as a devDependency is only worth it to pin a version, for a CI gate
say; the bins are then run with `bunx` / `pnpm exec` / `yarn exec`.

Every bin may be run from any subdirectory: it walks up to the nearest lockfile
and operates on that project, naming on stderr the lockfile it found when it is
not the working directory. No lockfile anywhere up the tree is an error, not a
silent no-op.

[yarn-why-duplicate](packages/yarn-why-duplicate) is the older, plain-JS tool
that shells out to `yarn why`; it explains one package and does not dedupe.
Prefer `yarn-berry-why-duplicate`, which reads the lockfile directly.

<h3>🧩 How dedupe works</h3>

A duplicate survives for one of two reasons, and each needs a different pass.

The **cluster pass** handles families published in lockstep — `@babel/*`,
`@typescript-eslint/*`, a package and its own plugins — whose duplicates only
disappear when the whole family moves to one version. Reaching a version the
lockfile does not already carry requires a real resolution, so this pass edits
`package.json` (or `pnpm-workspace.yaml`), runs the package manager, and uses
overrides (`resolutions` for yarn) as transient scaffolding: they are removed and
the project re-resolved, and a fix that only holds while an override stands is
reverted rather than applied.

The **lockfile pass** then merges what the resolver left behind — entries whose
ranges already overlap a version present in the lockfile — by rewriting the
lockfile in place. `pnpm-dedup` has no pass of its own here: it delegates to
`pnpm dedupe`.

Both passes are reported by one summary, counting and naming both sides so a
family converging onto an older release reads as copies merging rather than as a
downgrade:

```
Deduped 2 packages, 2 copies merged:
  barcode-detector: 2 versions (3.0.3, 3.2.2) -> 1 version (3.0.3)
  zxing-wasm:       2 versions (2.2.4, 3.1.3) -> 1 version (2.2.4)
No duplicate left.
```

`--check` prints the plan, writes nothing, and exits 1 if anything would change.
`-n` / `--dry-run` is the same output with exit 0. `bun-dedupe` and
`yarn-berry-deduplicate` also take `--no-clusters` to run the lockfile pass only.

<h3>🔎 Progressive deduplication</h3>

Deduping the whole lockfile is the default and what a run does when told
nothing. In case you only need to dedupe part of it, `bun-dedup`, `pnpm-dedup`
and `yarn-berry-deduplicate` share the same `--packages` / `--scopes` /
`--exclude` / `--exclude-scopes` flags, so a run can be bound to one family, or
to everything but a few packages. See each package's README for what its dedupe
pass does with them.

Each flag takes a comma list or is repeated. `--packages` / `--scopes` say what
may be touched, `--exclude` / `--exclude-scopes` win over them, and selecting
nothing selects everything. Patterns are globs with path semantics, so
`@babel/*` matches `@babel/core` and a bare `*` matches unscoped names only.

A lockstep family moves as one: a cluster fix is kept only when the filter
selects every member, otherwise it is skipped and the plan names the members
that blocked it.

<h3>🛠️ Development</h3>

```sh
bun install
bun test          # TZ=UTC, includes end-to-end tests that run the real package managers
bun run tsc
bun run lint
bun run checks    # dependency consistency across the workspace
```

Source is `.ts` run directly — no build step is needed to run the bins.
`bun run build` only emits the `dist/` type definitions and JS used for
publishing.

The end-to-end suites create real temporary projects and invoke `bun`, `pnpm` or
`yarn`; they are slow and require that package manager on `PATH`.
