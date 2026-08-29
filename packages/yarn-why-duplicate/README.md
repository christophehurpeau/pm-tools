<h1 align="center">
  yarn-why-duplicate
</h1>

<p align="center">
  Simple bin to know why a package is duplicated
</p>

<p align="center">
  <a href="https://npmjs.org/package/yarn-why-duplicate"><img src="https://img.shields.io/npm/v/yarn-why-duplicate.svg?style=flat-square" alt="npm version"></a>
  <a href="https://npmjs.org/package/yarn-why-duplicate"><img src="https://img.shields.io/npm/dw/yarn-why-duplicate.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://npmjs.org/package/yarn-why-duplicate"><img src="https://img.shields.io/node/v/yarn-why-duplicate.svg?style=flat-square" alt="node version"></a>
  <a href="https://npmjs.org/package/yarn-why-duplicate"><img src="https://img.shields.io/npm/types/yarn-why-duplicate.svg?style=flat-square" alt="types"></a>
</p>

## Usage

With yarn berry:

```
yarn dlx yarn-why-duplicate <dependencyName>
```

One package name, no flags. It runs `yarn why <dependencyName> --json` in the
working directory, groups the answer by resolved version, and prints each
version with the dependents that asked for it and the range they asked with:

```
Found 2 versions:

semver@npm:7.8.5
- eslint@npm:10.4.0 (semver@npm:^7.6.3)
- ts-api-utils@npm:2.1.0 (semver@npm:^7.7.1)

semver@npm:6.3.1
- @babel/core@npm:7.28.4 (semver@npm:^6.3.1)
```

`No version found` means yarn reported nothing for that name — usually a typo,
or a package that is not in the tree.

Requires yarn berry (>= 2): yarn 1's `yarn why` output is a different format and
is rejected with an explicit message rather than misparsed. Exits 1 on that and
on any error yarn reports.

### Prefer yarn-berry-why-duplicate

This is the original tool, kept working and unchanged. It shells out to
`yarn why`, so it explains one package at a time, spawns yarn per run, and knows
nothing about lockstep families or about fixing anything.

[yarn-berry-why-duplicate](../yarn-berry-deduplicate) reads `yarn.lock` directly
and is what to reach for now: it lists every duplicate at once, takes globs and
package filters, reports the lockstep clusters, tells you which copies can be
merged — and its sibling `yarn-berry-deduplicate` applies the merges.

## Notes

- CLI only: there is no importable API. The `exports` map points `.` at
  `./lib/index.js`, which the package does not ship, and exposes no subpath —
  so `import "yarn-why-duplicate"` fails. Internally the bin is three steps,
  `readAndParseYarnWhy` → `identifyDuplicates` → `displayDuplicates`, each in
  its own file under `lib/` and each unit-tested against recorded `yarn why`
  output in `test/fixtures/`.
- Plain JavaScript, no TypeScript and no build; node `>=22.18.0`.
- `Found N versions` counts every version of the named package, duplicated or
  not — one version is a normal answer, not an error.
- Colors and descriptor formatting come from `@yarnpkg/core`, configured from
  the working directory, so output matches what yarn itself prints.
