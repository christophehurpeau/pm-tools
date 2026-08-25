import type { LockstepGraph } from "pm-utils";
import type { PackagesMap } from "./buildPackagesMap.ts";

// Adapt the bun lockfile model into the package-manager-neutral graph consumed
// by `buildLockstepClusters`. bun stores the requested ranges in
// `info.dependencies`, so they map straight through.
export const toLockstepGraph = (packagesMap: PackagesMap): LockstepGraph =>
  Object.fromEntries(
    Object.entries(packagesMap).map(([name, resolutions]) => [
      name,
      resolutions.map((resolution) => {
        const pkg = resolution.package;
        if (pkg.type !== "npm") {
          return { version: "", isNpm: false, dependencies: {} };
        }
        return {
          version: pkg.version,
          isNpm: true,
          dependencies: pkg.info.dependencies ?? {},
        };
      }),
    ]),
  );
