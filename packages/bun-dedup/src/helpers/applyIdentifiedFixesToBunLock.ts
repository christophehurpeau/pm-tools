/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { BunLockFile } from "bun";
import type { ResolutionFix } from "../identifyResolutionFixes.ts";

export interface ApplyFixesResult {
  changed: boolean;
  changedKeys: string[];
}

export function applyIdentifiedFixesToBunLock(
  bunLockResult: BunLockFile & { packages: Record<string, any> },
  identifiedFixesMap: Map<string, ResolutionFix[]>,
): ApplyFixesResult {
  const changedKeys: string[] = [];
  // The entries nested under a replaced key describe the private tree of the
  // version that is gone: its own pins, which the target may not even accept.
  // Left in place, `bun install` keeps installing them as if they still
  // belonged to the tree, so they are dropped and re-resolved from the target's
  // manifest instead.
  const droppedKeys = new Set<string>();

  for (const fixes of identifiedFixesMap.values()) {
    for (const fix of fixes) {
      const toResolution = fix.to;

      const toEntry = Object.entries(bunLockResult.packages).find(
        ([, arr]) => arr?.[0] === toResolution,
      );
      if (!toEntry) continue;
      const toArray = toEntry[1];

      for (const [key, arr] of Object.entries(bunLockResult.packages)) {
        const currentResolution = arr?.[0];
        if (
          currentResolution &&
          fix.megeableResolutions.includes(currentResolution) &&
          currentResolution !== toResolution
        ) {
          bunLockResult.packages[key] = Array.isArray(toArray)
            ? [...toArray]
            : [toResolution];
          if (!changedKeys.includes(key)) changedKeys.push(key);

          for (const nestedKey of Object.keys(bunLockResult.packages)) {
            if (nestedKey.startsWith(`${key}/`)) {
              droppedKeys.add(nestedKey);
              if (!changedKeys.includes(nestedKey)) changedKeys.push(nestedKey);
            }
          }
        }
      }
    }
  }

  if (droppedKeys.size > 0) {
    bunLockResult.packages = Object.fromEntries(
      Object.entries(bunLockResult.packages).filter(
        ([key]) => !droppedKeys.has(key),
      ),
    );
  }

  return { changed: changedKeys.length > 0, changedKeys };
}
