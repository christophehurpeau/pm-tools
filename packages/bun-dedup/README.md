<h1 align="center">
  bun-dedup
</h1>

<p align="center">
  Simple bin to know why a package is duplicated
</p>

<p align="center">
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/v/bun-dedup.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/dw/bun-dedup.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/node/v/bun-dedup.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/bun-dedup"><img src="https://img.shields.io/npm/types/bun-dedup.svg?style=flat-square" alt="types"></a>
</p>

## Usage

### List duplicates, or explain one

```
bunx bun-why-duplicate                 # every duplicate, with the lockstep clusters behind them
bunx bun-why-duplicate <dependencyName>  # only the matching packages, and the clusters they belong to
bunx bun-why-duplicate <dependencyName> --all
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
bunx bun-dedupe              # apply
bunx bun-dedupe --dry-run    # print the plan, change nothing, exit 0
bunx bun-dedupe --check      # print the plan, change nothing, exit 1 if anything would change
```

`--check` is the CI gate; `--dry-run` (`-n`) is the same output without the
failing exit code.

Two passes run: the cluster pass edits `package.json` and runs `bun install`,
reaching versions the lockfile does not carry; the pure-lock pass then collapses
the leaves bun did not merge on its own. `--no-clusters` runs only the second.

Colors follow the terminal: `NO_COLOR` and a piped stdout turn them off,
`FORCE_COLOR` turns them on.
