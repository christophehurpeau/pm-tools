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
        }
      }
    }
  }

  return { changed: changedKeys.length > 0, changedKeys };
}
