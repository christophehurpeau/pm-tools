# Plan: dedupe lockstep clusters via re-resolution

Status: reviewed and empirically validated against the
`duplicated-typescript-eslint` fixture (bun 1.3.9). Awaiting implementation.
See "Empirical findings" below — they revise the original apply strategy
(overrides are transient, not persistent; only the cluster roots need
re-resolution).

## Goal

Make `bun-dedupe` identify (and ideally apply) dedupes like the
`@typescript-eslint/*` family in
`test/fixtures/duplicated-typescript-eslint`, where 16 packages are duplicated
but `identifyResolutionFixes` currently reports zero fixes.

Guard test pinning the current behaviour:
`src/identifyResolutionFixes.test.ts` → `"should not identify any fix for the
typescript-eslint duplicates"`. It asserts 16 duplicates and 0 fixes. The pure
per-package function `identifyResolutionFixes` should keep this behaviour (the
mix of exact `"8.59.1"`/`"8.61.0"` requests is genuinely unmergeable by a
lockfile copy). The new cluster detector is a separate function, so the guard
stays as a regression check on the old one.

## How dedupe works today

Flow (`src/index.ts`):

1. `parseBunLockPackages` → `buildPackagesMap` → `filterDuplicatesPackagesMap`
   gives `name -> PackageResolution[]` for every package with >1 installed
   resolution.
2. `collectDependents` builds `name -> Dependent[]`, where each `Dependent` is
   a requester (workspace entry or a package's `info.dependencies`) with the
   raw requested range string. Note: **only `dependencies` are collected**, not
   `peerDependencies`/`optionalDependencies` (see
   `collectDependents.test.ts`).
3. `identifyResolutionFixes(resolutions, dependents)` decides, per package,
   whether the installed resolutions can collapse onto one:
   - If a single installed version satisfies **all** dependents' ranges, merge
     onto it (covering branch picks the **highest** such version).
   - Otherwise a greedy highest→lowest pass merges any subset that is fully
     covered.
4. `applyIdentifiedFixesToBunLock` rewrites the lockfile: each package entry
   whose resolution is in `fix.megeableResolutions` is overwritten with a
   **copy of the `fix.to` entry** that is already in the lockfile.

Two structural constraints follow from step 4:

- **The target version must already be installed** — apply copies an existing
  lockfile entry; it never fetches a manifest.
- **It is a pure lockfile edit, no network, no re-resolution.**

This is why we can and do dedupe to a _lower_ installed version when that one
covers everyone — it minimizes installed versions and cross-version conflicts.
The limitation is that the target has to be physically present in the lock.

## Why the typescript-eslint case is not handled

The duplicated leaves (`utils`, `scope-manager`, `types`, `typescript-estree`,
`project-service`, `tsconfig-utils`, `visitor-keys`) each have both `8.59.1`
and `8.61.0` installed. The dependents asking for `"8.61.0"` are almost all
**exact** pins emitted by sibling packages in the same family
(`@typescript-eslint/eslint-plugin@8.61.0`, `parser@8.61.0`,
`type-utils@8.61.0`, `typescript-eslint@8.61.0`).

These exact requests are not real external constraints — they exist **only
because those roots resolved to 8.61.0**. The roots resolved high because
`@pob/eslint-config@65.5.0` requests them with carets (`^8.59.1` → 8.61.0). The
only thing pinning the 8.59.1 subtree alive is one exact pin:
`@pob/eslint-plugin@65.5.0` → `"@typescript-eslint/utils": "8.59.1"`.

So `identifyResolutionFixes` correctly finds no single installed version that
satisfies the mix of `"8.59.1"` and `"8.61.0"` exact requests — the requests
are mutually exclusive _as long as the roots stay at 8.61.0_.

Convergence to a single version is possible, but only by **downgrading the
roots** (`eslint-plugin`/`parser`/`typescript-eslint`) to 8.59.1, which their
parent's `^8.59.1` allows. Those roots are **not** duplicated — only 8.61.0 is
installed — so their 8.59.1 manifests are absent from the lock.
`applyIdentifiedFixesToBunLock` cannot synthesize them. **This fix requires a
`bun install` round-trip to fetch the root manifests, not a lockfile copy.**

## Empirical findings (bun 1.3.9, fixture scratch copies)

These measured results drive the design below.

1. **Re-resolving the roots cascades the family.** Forcing only the
   externally-requested roots (`eslint-plugin`, `parser`, `typescript-eslint`)
   to `8.59.1` collapsed all 16 duplicates to a single `8.59.1` save one
   residual. The leaves were never pinned — their internal exact pins
   (`scope-manager: "8.61.0"` etc.) followed the roots automatically. You do
   **not** pin the 16 cluster members; you re-resolve the few members that
   carry an external dependent and the rest cascades. `type-utils` is
   internal-only (requested solely by `eslint-plugin@x` exact) — it cascades
   without being targeted.

2. **The deduped state is stable without a standing override.** Removing the
   `overrides` block and reinstalling kept the roots at `8.59.1` (bun's
   minimal-change resolution does not re-bump a within-range entry), and
   `bun install --frozen-lockfile` passed with no changes. The override is
   therefore **transient**: apply → `bun install` → remove → `bun install`. No
   permanent `package.json` pollution; the result is CI-reproducible.

3. **A blind offline lock edit does not work for the roots.** Lowering a root's
   resolution string + fabricating its dependency map + blanking integrity, then
   `bun install`, did **not** cascade (`parser@8.59.1` ended paired with
   `scope-manager@8.61.0`) and left integrity blank/unverifiable. The four root
   manifests at `8.59.1` are absent from the lock, so one `bun install`
   round-trip to fetch them is unavoidable regardless of mechanism. Do not
   attempt offline lock surgery for the roots.

4. **A residual remains for the existing pure-lock pass.** After the cascade, two
   copies of `types@8.61.0` survived, pulled by `project-service` (`^8.59.1`)
   and `eslint-plugin-import-x` (`^8.56.0`). Both ranges already accept
   `8.59.1`, so this is a plain merge `identifyResolutionFixes` already handles.
   Pipeline implication: **cluster re-resolution, then re-run the existing
   pure-lock pass** to finish leftovers bun did not collapse on its own.

5. **Target math confirmed.** `^8.59.1 ∩ ^8.59.1 ∩ =8.59.1 ∩ ^8.56.0 = 8.59.1`,
   and `8.59.1` installs consistently with no peer-dependency breakage.

## Proposed solution

Two separable deliverables. Ship the detector first; it is pure-lockfile and
immediately useful even without auto-apply.

### Part 1 — detector (pure lockfile, no network)

New module, e.g. `src/identifyClusterFixes.ts`, run alongside
`identifyResolutionFixes` and surfaced in `displayMany`.

1. **Build the request graph.** For each duplicated package, and for each of
   its installed resolutions, read `info.dependencies`. Record edges
   `requester@version --(range)--> depName`. Requester identity comes from the
   `Dependent.bunPackage` (`name`, `version`); workspace requesters have no
   `bunPackage`.

2. **Detect lockstep clusters via co-version, not range syntax.** Union-find
   over package _names_. Union A and B iff (a) a dependency edge A→B exists in
   the lock, and (b) across **every** installed resolution where A requests B,
   A and B carry the **same version**. The connected component is a family
   published in lockstep.

   Why co-version rather than the earlier "exact string equal to A's own
   version" rule: the exact-string rule misses caret internal pins. In the
   fixture, `project-service@8.61.0` requests `tsconfig-utils: "^8.61.0"` and
   `types: "^8.61.0"` (caret, not exact); after cascade `project-service@8.59.1`
   requests `types: "^8.59.1"`. The co-version rule captures these (equal
   versions regardless of the `^`), excludes `semver`/`minimatch`/`debug`
   (versions differ), and needs no npm-scope assumption — essential here because
   the cluster includes the **unscoped** `typescript-eslint`, so any scope-based
   detector fails on this exact fixture. It also avoids the coincidental
   equal-version false merge, because it requires the real edge **and**
   co-version across all observations, not a bare version-number match.

   Expected output for the fixture: one cluster containing all
   `@typescript-eslint/*` members _including_ the non-duplicated roots
   `eslint-plugin`, `parser`, `type-utils`, `typescript-eslint`. Single-version
   roots co-version with their leaves and join naturally.

3. **Partition each member's dependents into internal vs external.**
   - internal: requester name ∈ cluster → its range is _derived_, discard it.
   - external: requester ∉ cluster → a real constraint to honor.

   For the fixture the external constraints on the whole cluster reduce to:
   - `@pob/eslint-config`: `eslint-plugin`/`parser`/`typescript-eslint` → `^8.59.1`
   - `@pob/eslint-plugin`: `utils` → `8.59.1` (exact)
   - `eslint-plugin-import-x`: `types` → `^8.56.0`

4. **Intersect external ranges across the cluster** and pick a target version.
   `^8.59.1 ∩ ^8.59.1 ∩ =8.59.1 ∩ ^8.56.0` = `8.59.1`. Use `semver` to find
   versions satisfying every external range. Candidate set = versions present
   anywhere in the lock for cluster members (plus, in Part 2, manifests). Pick
   the version satisfying all external ranges; if several, pick the highest
   (still may be lower than the current high — that is the intended
   "dedupe down" behaviour). Report **target version + direction (up/down)**;
   never silently downgrade without surfacing it.

5. **Compute the re-resolution set.** Not the whole cluster — only members that
   (a) carry at least one external dependent and (b) currently resolve **above**
   the target. For the fixture: `eslint-plugin`, `parser`, `typescript-eslint`
   (`type-utils` is internal-only → cascades; `utils` already sits at `8.59.1`).

6. **Emit a cluster-fix record**: cluster members, target version, direction,
   the re-resolution set, the external constraint that sets the floor/ceiling
   (here `@pob/eslint-plugin`'s exact pin), and whether it is applicable purely
   from the lock (target already installed for _every_ member) or needs a
   `bun install` round-trip (some root lacks the target version in the lock).

Detector output turns "16 duplicates, 0 fixable" into "1 cluster
(`@typescript-eslint/*`), dedupable to 8.59.1; needs a `bun install` round-trip
because `eslint-plugin`/`parser`/`typescript-eslint`@8.59.1 are not installed;
re-resolve those 3, the rest cascades."

### Part 2 — apply via transient override + re-resolve

Pure offline lockfile copy is insufficient for the roots (manifests absent) and
a blind lock edit does not cascade (finding 3). A standing override is **not**
required (finding 2). Apply path:

1. Write a bun override pinning **only the re-resolution set** (step 5 above,
   not the whole cluster) to the target version — `overrides` in the workspace
   root `package.json`.
2. Run `bun install` to fetch the root manifests, re-resolve, and rebuild the
   tree. The internal exact pins cascade the leaves automatically.
3. **Remove the override** and run `bun install` again. bun preserves the
   lowered, within-range resolutions (finding 2), so the override leaves no
   trace.
4. Re-run the existing pure-lock pass (`identifyResolutionFixes` +
   `applyIdentifiedFixesToBunLock`) to collapse residuals bun did not dedupe on
   its own (finding 4).
5. **Verify** with the full duplicate scan before/after and
   `bun install --frozen-lockfile`. Roll back (restore the saved
   `package.json` + `bun.lock`) if the cluster did not collapse or new
   duplicates appeared.

Correctness of transitive consistency is delegated to bun's resolver — the tool
proposes and verifies rather than hand-editing entries it cannot validate.
Never ship a lock with blank (`""`) integrity (finding 3); the round-trip fills
it.

Alternative (Part 2b, optional): registry-aware mode that fetches candidate
manifests to validate transitive pins before writing, removing the
install-and-check round trip at the cost of a network dependency the package
does not currently have. Defer unless reviewer wants it. If added, the
`repository.url` + `repository.directory` agreement across members is a useful
confidence boost on top of co-version (see below) — never a primary detector.

### On the `repository` field as a cluster signal

A corroborating hint only, not a detector:

- **Not in `bun.lock`.** Entries store `[resolution, registry, {dependencies,
peerDependencies, …}, integrity]` — no `repository`/`homepage`. Using it needs
  a manifest fetch (Part 2b territory); the co-version rule needs nothing the
  lock lacks.
- **Not sufficient.** "Same monorepo" ≠ "moves in lockstep". Independently
  versioned monorepos (lerna independent mode, etc.) publish same-repo packages
  at divergent versions.
- **Not necessary.** Co-version already proves lockstep for this family.

Use only as a tie-breaker / false-merge guard in the network mode.

## Code touch points

- New: `src/identifyClusterFixes.ts` (+ test).
- New: co-version cluster helper, e.g. `src/helpers/buildLockstepClusters.ts`
  (union-find over the realized resolution graph).
- `src/index.ts`: call the detector in `listDuplicates`, thread results into
  `displayMany`.
- `src/displayMany.ts`: render cluster fixes (distinct from per-package
  `ResolutionFix`).
- `fixDuplicates`: gate the override+install+rollback path behind an explicit
  flag (it mutates `package.json` and runs `bun i` — heavier and less reversible
  than the current pure-lock rewrite). Keep dry-run support. After the
  round-trip, reuse the existing pure-lock pass for residuals.
- Consider whether `collectDependents` must also collect `peerDependencies`:
  the cluster's exact internal pins are regular `dependencies` and the cascade
  succeeded without peers, but root peer ranges (`eslint-plugin` peer-depends
  `parser ^8.59.1`) could matter if a future cluster's peer ranges are tighter
  than its dep ranges. Currently peers are ignored by design; the verify step
  catches a bad target after the fact. Revisit only if it produces wrong
  targets.

## Risks / edge cases

- **Direction.** Target may be a downgrade. Acceptable per existing philosophy
  but must be reported, not hidden.
- **Cluster over-reach.** Co-version unioning requires the dependency edge to
  exist _and_ equal versions across all observations, which guards against
  merging unrelated packages that share a version number.
- **Multiple independent clusters / partial convergence.** External ranges may
  admit no common version (genuinely unfixable) — report and skip.
- **Workspace requesters** have no `bunPackage`; always treat as external.
- **Re-resolution may shift unrelated packages.** The verify step must compare
  the full duplicate set before/after, not just the targeted cluster.
- **Residual non-cluster duplicates.** bun may leave within-range leaves
  un-collapsed (finding 4); the existing pure-lock pass must run after the
  round-trip.
- **Integrity.** Never write lock entries the tool cannot hash; force the
  `bun install` round-trip to fill integrity and gate on `--frozen-lockfile`.
- **peerDependencies blind spot** (above).

## Test plan

- Keep the guard test in `identifyResolutionFixes.test.ts` (16 duplicates, 0
  fixes) as a regression check on the unchanged pure-lock function.
- New unit tests for cluster detection on the `duplicated-typescript-eslint`
  fixture: assert one cluster with the expected members (including unscoped
  `typescript-eslint`), target `8.59.1`, direction down, re-resolution set
  `{eslint-plugin, parser, typescript-eslint}`, flagged "needs round-trip".
- New unit test asserting the external/internal partition drops the derived
  `"8.61.0"` exacts and keeps `@pob/eslint-config`'s `^8.59.1`,
  `@pob/eslint-plugin`'s `=8.59.1`, `import-x`'s `^8.56.0`.
- New unit test asserting the co-version rule unions on caret internal pins
  (`project-service` → `^8.x` siblings) and excludes `semver`/`debug`.
- Keep the existing `displayMany` exact-output test; add coverage for the new
  cluster rendering.
- Apply path (Part 2) is integration-level; gate behind a flag and test the
  override-write → install → override-remove → install → residual-pass → verify
  logic with a stubbed install if feasible. Assert `--frozen-lockfile` passes
  and integrity is non-empty after.

## Open questions for reviewer

1. Detector-only first, or detector + apply in one change?
2. Should the apply path always go through the transient-override round-trip, or
   is Part 2b (network manifest validation) wanted to avoid `bun i`?
3. Confirm `identifyClusterFixes` stays separate from `identifyResolutionFixes`
   (keeps the pure-lockfile guarantees of the existing function).
