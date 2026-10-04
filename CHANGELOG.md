# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.1.0](https://github.com/christophehurpeau/pm-tools/compare/v2.0.0...v2.1.0) (2026-10-04)

### ⚠ BREAKING CHANGES

* drop node 18

### Features

* add empty pm-tools package to reserve the name on npm
* add experimental bun-why-duplicate
* cluster dedupe, many tests and fixes
* **deps:** update dependency @types/bun to v1.4.2 ([#176](https://github.com/christophehurpeau/pm-tools/issues/176))
* **deps:** update dependency semver to v7.6.0 ([#79](https://github.com/christophehurpeau/pm-tools/issues/79))
* improvements, docs and yarn support
* pnpm-dedup
* rename pm-utils to pm-dedup-core, point bins at dist, add bun-dedup bin alias

### Bug Fixes

* **deps:** update dependency @yarnpkg/core to v4.9.2 ([#178](https://github.com/christophehurpeau/pm-tools/issues/178))
* **deps:** update dependency picomatch to v4.0.7 ([#173](https://github.com/christophehurpeau/pm-tools/issues/173))
* **deps:** update dependency yaml to v2.9.1 ([#179](https://github.com/christophehurpeau/pm-tools/issues/179))
* **deps:** update yarn monorepo ([#69](https://github.com/christophehurpeau/pm-tools/issues/69))
* enhance alias handling in dependency resolution and add tests

### Miscellaneous Chores

* update dev deps and node version

