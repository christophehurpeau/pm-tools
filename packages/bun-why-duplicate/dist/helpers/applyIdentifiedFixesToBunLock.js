export function applyIdentifiedFixesToBunLock(bunLockResult, identifiedFixesMap) {
    const changedKeys = [];
    for (const fixes of identifiedFixesMap.values()) {
        for (const fix of fixes) {
            const toResolution = fix.to;
            const toEntry = Object.entries(bunLockResult.packages).find(([, arr]) => arr && arr[0] === toResolution);
            if (!toEntry)
                continue;
            const toArray = toEntry[1];
            for (const [key, arr] of Object.entries(bunLockResult.packages)) {
                const currentResolution = arr?.[0];
                if (currentResolution &&
                    fix.megeableResolutions.includes(currentResolution) &&
                    currentResolution !== toResolution) {
                    bunLockResult.packages[key] = Array.isArray(toArray)
                        ? [...toArray]
                        : [toResolution];
                    if (!changedKeys.includes(key))
                        changedKeys.push(key);
                }
            }
        }
    }
    return { changed: changedKeys.length > 0, changedKeys };
}
//# sourceMappingURL=applyIdentifiedFixesToBunLock.js.map