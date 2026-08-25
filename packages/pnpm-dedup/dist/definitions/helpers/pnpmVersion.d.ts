import type { PnpmRunner } from "./runPnpm.ts";
/**
 * Convergence overrides (`overrides: { "pkg@": "1.2.3" }`, empty range selector)
 * landed in pnpm 11.13.0. They rewrite a dependency edge only when the declared
 * range accepts the exact version, which is what lets a cluster converge without
 * forcing the members a third-party range legitimately pins elsewhere.
 */
export declare const convergenceOverridesMinVersion = "11.13.0";
export declare const readPnpmVersion: (run?: PnpmRunner) => string | null;
export declare const supportsConvergenceOverrides: (version: string) => boolean;
//# sourceMappingURL=pnpmVersion.d.ts.map