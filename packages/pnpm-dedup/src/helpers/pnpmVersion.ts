import semver from "semver";
import { runPnpm } from "./runPnpm.ts";
import type { PnpmRunner } from "./runPnpm.ts";

/**
 * Convergence overrides (`overrides: { "pkg@": "1.2.3" }`, empty range selector)
 * landed in pnpm 11.13.0. They rewrite a dependency edge only when the declared
 * range accepts the exact version, which is what lets a cluster converge without
 * forcing the members a third-party range legitimately pins elsewhere.
 */
export const convergenceOverridesMinVersion = "11.13.0";

export const readPnpmVersion = (run: PnpmRunner = runPnpm): string | null => {
  const result = run(["--version"], { stdio: "pipe" });
  if (result.status !== 0) return null;
  // pnpm prints its warnings (a `workspaces` field in package.json, an update
  // notice) into the same captured output, so the version is the last line that
  // is one, not the last line.
  return (
    result.output
      .split("\n")
      .map((line) => line.trim())
      .findLast((line) => semver.valid(line) !== null) ?? null
  );
};

export const supportsConvergenceOverrides = (version: string): boolean =>
  semver.gte(version, convergenceOverridesMinVersion);
