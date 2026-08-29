# pm-tools

Monorepo of CLI tools that find and fix duplicated dependencies in package manager lockfiles (bun, pnpm, yarn berry).

Two things every tool does:

- **why-duplicate**: report which dependents force a package to resolve to several versions.
- **dedupe**: compute fixes (narrowing ranges, adding overrides/resolutions), optionally apply them to manifests + lockfile.

## Packages

| Package                                                   | What it is                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [pm-utils](packages/pm-utils)                             | Shared, package-manager-agnostic core: lockstep clusters, fix identification, apply planning, report rendering. Consumed via `workspace:*`. |
| [bun-dedup](packages/bun-dedup)                           | `bun-dedupe`, `bun-why-duplicate` — reads `bun.lock`.                                                                                       |
| [pnpm-dedup](packages/pnpm-dedup)                         | `pnpm-dedupe`, `pnpm-why-duplicate` — reads `pnpm-lock.yaml`.                                                                               |
| [yarn-berry-deduplicate](packages/yarn-berry-deduplicate) | `yarn-berry-deduplicate`, `yarn-berry-why-duplicate` — reads yarn berry `yarn.lock`.                                                        |
| [yarn-why-duplicate](packages/yarn-why-duplicate)         | Older, plain-JS tool that parses `yarn why` output. Not TypeScript, not on the shared core.                                                 |

`bun-dedup`, `pnpm-dedup` and `yarn-berry-deduplicate` follow the same shape: `src/index.ts` (public API), `src/bin/*.ts`, `src/helpers/*` for the PM-specific lockfile parsing / graph building, then delegate the actual algorithm to `pm-utils`. When changing behavior in one, check whether the others need the same change or whether the logic belongs in `pm-utils`.

They share a CLI grammar too: `--check`, `-n`/`--dry-run` and the `--packages` / `--scopes` / `--exclude` / `--exclude-scopes` filters, all parsed through `pm-utils`' `parseBinArgs` + `packageFilterParseArgsOptions`.

A `peerDependencies` range constrains its requester's resolved version exactly as a dependency range does, and each package manager loses a different half of it:

- **yarn** folds the peer provision into the virtual package's `dependencies`, which is why `yarn why` lists peer requesters — but `generateLockfile` skips virtual packages, so `yarn.lock` keeps peer ranges in a block of their own and the **edge** is what goes missing. `collectYarnDependents` reads `peerDependencies` explicitly. It cannot tell whether a peer was actually provided, so it keeps optional ones too: a constraint that may not bind costs a suppressed merge, a missing one costs a merge that breaks a peer.
- **pnpm** resolves peers before writing, folds each into the snapshot's `dependencies` and encodes the context in the peer-suffixed key — so the edge is present, and an edge that exists means the peer _was_ provided. What goes missing is the **range**: the snapshot stores the resolved version. `collectDependentRanges` reads the manifest first, then falls back to the lockfile's own `packages:` entry (`PackageMeta.peerDependencies`), so peer ranges survive with no `node_modules` — otherwise 17 plugins declaring `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"` and friends all read as exact pins of whatever installed, and nothing can be merged. Note the direction: for pnpm this loss _suppressed_ merges, where yarn's _invented_ them.
- **bun** reads `dependencies` only — a known gap, so `@babel/core` looks unconstrained by the `@babel/plugin-*` that peer-depend on it (pinned by name in `collectDependents.test.ts`).

Neither manager creates a duplicate from a peer range on its own: both resolve peers against what is already in the tree and warn instead of backtracking. pnpm's peer-suffixed keys are several _installations_ of one version, which `buildPnpmPackagesMap` folds into one resolution — only distinct versions count as duplicates. So a peer range never explains why a second version exists; it is an extra constraint on a package duplicated for other reasons, which is exactly why losing it changes the fixes. Both reports mark such a dependent with a dim `(peer)` after the range — `DuplicateDependentView.peer`, never appended to the requester, which would push long names past `maxColumnWidth` and leave the column ragged.

Cluster _membership_ diverges as a consequence, not by separate decision: `toLockstepGraph` reads `dependencies` in both, which for pnpm already contains the resolved peers and for yarn does not. Do not add peers to yarn's — an unrelated peer that happens to be co-version (`eslint-plugin-x@9.0.0` peer `eslint@^9.0.0`) would union two packages into a family. pnpm is safe from that only because its snapshot values are resolved versions.

Dedupe runs in two passes. The **cluster pass** edits `package.json` and re-runs the package manager, which is the only way to reach a version the lockfile does not already carry; it writes overrides (`resolutions` for yarn) as transient scaffolding and reverts unless the result holds without them. The **lockfile pass** then merges what the resolver left behind, by rewriting the lockfile in place. `pnpm-dedup` has no lockfile pass of its own — it defers to `pnpm dedupe`.

## Working in this repo

- Managed with **bun** workspaces (`bun.lock`, `bunfig.toml`) — the README's "Yarn Workspaces" line is stale.
- `bun test` (root, `TZ=UTC`), `bun run tsc`, `bun run lint`, `bun run checks` (dependency consistency).
- Source is `.ts` run directly — no build step needed to run bins. `bun run build` only emits `dist/` type definitions + JS for publishing; `dist/` is committed, which is why `bunfig.toml` excludes it from test discovery.
- No function resolves a lockfile path on its own: every read/write takes an explicit path, built by each package's `helpers/projectDir.ts` (`lockPathOf`, `resolve<Pm>ProjectDir`) from a `projectDir` that `pm-utils`' `resolveProjectDir` found by walking up from the working directory — that is what lets the bins run from a subdirectory. A default relative path (`readAndParseBunLock(filepath = "bun.lock")`) silently means "the working directory" and reintroduces the bug; keep the parameter required. `resolveProjectDir` returns null when there is no lockfile, having printed the reason and set the exit code — the `parseBinArgs` contract, and why the entry functions guard with `if (projectDir === null) return`.
- Tests live next to the source (`src/**/*.test.ts`). End-to-end dedupe tests create real temp projects and invoke the real package manager (`src/helpers/tempProjects.ts`, `runBun.ts` / `runPnpm.ts` / `runYarn.ts`) — they are slow and require the PM on PATH.
- Lockfile fixtures under `test/fixtures/<scenario>/` must be byte-exact: assert that parsing and re-serializing one returns it unchanged, or a "leaves a clean lockfile alone" test will fail on formatting rather than on behaviour. For yarn, a bare `yarn` is corepack's 1.x in a project that pins nothing, so a berry fixture carries `packageManager` and its own `.yarnrc.yml`, and the e2e suite probes `yarn --version` **inside the fixture** before deciding to run.
- yarn's `nodeLinker` never reaches the lockfile: resolution runs before linking, so `yarn.lock` is byte-identical under `pnp` and `node-modules`, and nothing in `yarn-berry-deduplicate` reads an installed tree. Only the e2e test can tell the two apart, and it runs once per linker — asserting against `node_modules/<pkg>/package.json` for one and `.pnp.cjs`'s cache-archive names for the other. Do not reach for `require("<pkg>/package.json")` as a linker-agnostic probe: pnp enforces `exports`, which most packages do not open on `./package.json`.
- Imports use explicit `.ts` extensions.

## Runtime: bun vs node

Bun is the dev toolchain (install, test) for the whole repo, but only `bun-dedup` may depend on the bun runtime at execution time.

- `bun-dedup`: bins are `#!/usr/bin/env bun`, and `Bun.*` / `import ... from "bun"` (e.g. `Glob`, `BunLockFile` types) are fine — it shells out to `bun` anyway.
- `pnpm-dedup`, `yarn-berry-deduplicate`, `yarn-why-duplicate`, `pm-utils`: **node only**. Bins are `#!/usr/bin/env node`, no bun imports, no `Bun.*`. Use Node APIs plus deps (`yaml`, `@yarnpkg/parsers`, `picomatch`) instead of `Bun.YAML` / `Bun.Glob`.
- Tests are the exception: every package uses `bun:test` and runs under `bun test`, including the node-only ones.
