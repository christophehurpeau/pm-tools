# TODO

## Stop shipping tests in the npm tarballs

`npm pack --dry-run` on `bun-dedup`, `pnpm-dedup`, `yarn-berry-deduplicate` and
`pm-dedup-core` lists every `*.test.ts` next to its source and every compiled
`*.test.js` (plus `.map`) under `dist/`, as well as the test-only helpers
(`tempProjects`, `runBun` / `runPnpm` / `runYarn`, `fixtures.ts`). They make up
a third to a half of each tarball.

`files` is a whitelist (`src`, `dist`), and npm's negation support inside it is
limited enough that `!src/**/*.test.ts` style entries are not a safe fix on their
own. Options to weigh:

- a separate `tsconfig.build.json` that excludes `**/*.test.ts` and the test
  helpers from emit, with `bun run tsc` keeping the full project for type checks;
- dropping `src` from `files` now that the bins point at `dist/bin`, which
  leaves only the `dist/**/*.test.*` copies to exclude;
- moving test helpers under a `test/` directory that `files` does not list.

Whatever the choice, assert the result with `npm pack --dry-run --json` in CI so
it does not regress.
