<h1 align="center">
  pm-tools
</h1>

<p align="center">
  Find out why a dependency is duplicated in a lockfile, and dedupe it.
</p>

<p align="center">
  <a href="https://npmjs.org/package/pm-tools"><img src="https://img.shields.io/npm/v/pm-tools.svg?style=flat-square" alt="npm version"></a>
</p>

This package is empty. It reserves the name of the
[pm-tools](https://github.com/christophehurpeau/pm-tools) monorepo on npm and
ships nothing: no bin, no API.

Install the tool for your package manager instead:

| Lockfile          | Package                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `bun.lock`        | [bun-dedup](https://npmjs.org/package/bun-dedup)                           |
| `pnpm-lock.yaml`  | [pnpm-dedup](https://npmjs.org/package/pnpm-dedup)                         |
| `yarn.lock` (v2+) | [yarn-berry-deduplicate](https://npmjs.org/package/yarn-berry-deduplicate) |

Their shared core is [pm-dedup-core](https://npmjs.org/package/pm-dedup-core).
