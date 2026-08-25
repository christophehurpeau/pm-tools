export const diffDuplicates = (before, after) => {
    const removed = [...before].filter((resolution) => !after.has(resolution));
    const added = [...after].filter((resolution) => !before.has(resolution));
    return {
        removed: removed.toSorted((a, b) => a.localeCompare(b)),
        added: added.toSorted((a, b) => a.localeCompare(b)),
        improved: added.length === 0 && removed.length > 0,
    };
};
//# sourceMappingURL=duplicateSnapshot.js.map