const nestedRunVariable = "PM_DEDUP_NESTED_RUN";

type Env = typeof process.env;

/**
 * The environment for a package manager a dedupe run spawns. An install can run
 * the project's own lifecycle scripts (pnpm and bun run the root `prepare`, yarn
 * does with `plugin-prepare-lifecycle`), so a dedupe wired into one re-enters
 * itself mid-apply, once per install it runs.
 */
export const nestedRunEnv = (env: Env = process.env): Env => ({
  ...env,
  [nestedRunVariable]: "1",
});

/**
 * True when this run was started by an install a dedupe run spawned, having
 * printed why. The exit code is left alone: the outer run is the one that
 * reports.
 */
export const skipNestedRun = (
  dedupeCommand: string,
  env: Env = process.env,
): boolean => {
  if (env[nestedRunVariable] !== "1") return false;
  console.error(
    `${dedupeCommand}: skipped, started by an install another dedupe run is driving`,
  );
  return true;
};
