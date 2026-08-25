<h1 align="center">
  pnpm-dedup
</h1>

<p align="center">
  Simple bin to know why a package is duplicated
</p>

<p align="center">
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/v/pnpm-dedup.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/dw/pnpm-dedup.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/node/v/pnpm-dedup.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/pnpm-dedup"><img src="https://img.shields.io/npm/types/pnpm-dedup.svg?style=flat-square" alt="types"></a>
</p>

## Usage

### List duplicates, or explain one

```
bunx pnpm-why-duplicate                 # every duplicate, with the lockstep clusters behind them
bunx pnpm-why-duplicate <dependencyName>  # only the matching packages, and the clusters they belong to
bunx pnpm-why-duplicate <dependencyName> --all
```

`<dependencyName>` is a glob, so `@babel/*` works. `--all` (`-a`) keeps packages
that are not duplicated.

The report is one pass: each duplicated package with its resolutions, its
dependents and how it would collapse; then the lockstep clusters — families
published together, whose duplicates only go away when the whole family moves;
then a single summary line. A package that belongs to a cluster carries a
`Cluster: N` line pointing at it.

### Dedupe

```
bunx pnpm-dedupe              # apply
bunx pnpm-dedupe --dry-run    # print the plan, change nothing, exit 0
bunx pnpm-dedupe --check      # print the plan, change nothing, exit 1 if anything would change
```

`--check` is the CI gate; `--dry-run` (`-n`) is the same output without the
failing exit code. `--check` also exits 1 when `pnpm dedupe --check` itself
cannot confirm the lockfile is settled, so a probe that fails for environmental
reasons fails the gate rather than passing silently.

`--no-convergence-overrides` writes plain overrides instead of convergence ones,
which pnpm applies to every requester whatever range it declares. Convergence
overrides need pnpm >= 11.13.0; without them the cluster pass is skipped.

Colors follow the terminal: `NO_COLOR` and a piped stdout turn them off,
`FORCE_COLOR` turns them on.
