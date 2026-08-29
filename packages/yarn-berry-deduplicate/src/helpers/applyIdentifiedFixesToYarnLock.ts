import type { ResolutionFix } from "pm-utils";
import { packageEntries } from "./syml.ts";
import type { YarnEntries, YarnEntry } from "./syml.ts";
import { splitEntryKey } from "./yarnDescriptor.ts";

export interface ApplyFixesResult {
  changed: boolean;
  changedKeys: string[];
}

export interface ApplyFixesToYarnLockResult {
  entries: YarnEntries;
  result: ApplyFixesResult;
}

interface Group {
  descriptors: string[];
  entry: YarnEntry;
}

const resolutionOf = (entryKey: string, entry: YarnEntry): string =>
  entry.resolution ?? splitEntryKey(entryKey)[0]!;

/**
 * Regroup the descriptors a fix merges under the entry it merges into.
 *
 * A yarn.lock key *is* the descriptor a requester declared, and that is how
 * yarn matches a dependency to an entry — so the descriptors are carried over
 * untouched and only the entry they sit under changes. Rewriting one to name
 * the target version instead would leave the range it replaced unlisted, and
 * yarn would resolve that range afresh and undo the merge.
 *
 * The lockfile that comes out asks for the merge; `yarn install` is what
 * performs it, and rewrites the checksums and nested trees this pass leaves
 * alone.
 */
export const applyIdentifiedFixesToYarnLock = (
  entries: YarnEntries,
  identifiedFixesMap: Map<string, ResolutionFix[]>,
): ApplyFixesToYarnLockResult => {
  const declaredTargets = new Map<string, string>();
  for (const fixes of identifiedFixesMap.values()) {
    for (const fix of fixes) {
      for (const resolution of fix.mergeableResolutions) {
        if (resolution !== fix.to) declaredTargets.set(resolution, fix.to);
      }
    }
  }

  /**
   * Two fixes for the same package can chain, one merging A onto B while the
   * other merges B onto C. Stopping at the first hop would leave A on an entry
   * that itself moved away, so the chain is followed to its end.
   *
   * A chain that loops back on itself says two versions each replace the other,
   * which no rewrite can honour. Rather than pick one and half-apply it, the
   * resolution is left where it is: a contradictory instruction is better
   * ignored than obeyed in part.
   */
  const finalTargetOf = (resolution: string): string => {
    const seen = new Set([resolution]);
    let target = resolution;

    for (;;) {
      const next = declaredTargets.get(target);
      if (next === undefined) return target;
      if (seen.has(next)) return resolution;
      seen.add(next);
      target = next;
    }
  };

  const targetByResolution = new Map(
    [...declaredTargets.keys()]
      .map((resolution) => [resolution, finalTargetOf(resolution)] as const)
      // a chain that led back to its start moves nothing, and an entry left
      // pointing at itself would still be reported as changed
      .filter(([resolution, target]) => target !== resolution),
  );

  // resolution -> the entry that carries it, so descriptors moving onto a
  // version no instance of their own group installed still find its body
  const entryByResolution = new Map<string, YarnEntry>();
  for (const [entryKey, entry] of packageEntries(entries)) {
    entryByResolution.set(resolutionOf(entryKey, entry), entry);
  }

  const changedKeys: string[] = [];
  const groups = new Map<string, Group>();

  for (const [entryKey, entry] of packageEntries(entries)) {
    const ownResolution = resolutionOf(entryKey, entry);
    const target = targetByResolution.get(ownResolution);

    const [resolution, groupEntry] = ((): [string, YarnEntry] => {
      if (target === undefined) return [ownResolution, entry];

      const targetEntry = entryByResolution.get(target);
      if (!targetEntry) {
        // Unreachable: a fix names resolutions read out of this very lockfile.
        // Grouping under a missing entry would drop its descriptors with it, so
        // fail loudly instead.
        throw new Error(`No lockfile entry found for "${target}"`);
      }
      changedKeys.push(entryKey);
      return [target, targetEntry];
    })();

    let group = groups.get(resolution);
    if (!group) {
      group = { descriptors: [], entry: groupEntry };
      groups.set(resolution, group);
    }
    group.descriptors.push(...splitEntryKey(entryKey));
  }

  const newEntries: YarnEntries = {};
  if (entries.__metadata) newEntries.__metadata = entries.__metadata;

  for (const group of groups.values()) {
    // sorted the way yarn writes a key, so a lockfile it would not have changed
    // comes back byte-identical
    newEntries[group.descriptors.toSorted().join(", ")] = group.entry;
  }

  return {
    entries: newEntries,
    result: { changed: changedKeys.length > 0, changedKeys },
  };
};
