// Every resolution that is one copy too many, as `name@version` ids. Sets, not
// counts: a change that removes one duplicate and introduces another is not an
// improvement, and a count would hide it.
export type DuplicateSnapshot = Set<string>;

export interface DuplicateDiff {
  removed: string[];
  added: string[];
  improved: boolean;
}

export const diffDuplicates = (
  before: DuplicateSnapshot,
  after: DuplicateSnapshot,
): DuplicateDiff => {
  const removed = [...before].filter((resolution) => !after.has(resolution));
  const added = [...after].filter((resolution) => !before.has(resolution));

  return {
    removed: removed.toSorted((a, b) => a.localeCompare(b)),
    added: added.toSorted((a, b) => a.localeCompare(b)),
    improved: added.length === 0 && removed.length > 0,
  };
};
