// DEFERRED (bun pipeline): carried over for the upcoming pnpm dedupe step.
// TODO rewrite onto the pnpm lockfile (write-back via yaml.stringify) and wire
// to a pnpm-dedupe bin. Not used by the current pnpm list path.
import { applyIdentifiedFixesToBunLock } from "./helpers/applyIdentifiedFixesToBunLock.js";
import { buildIdentifiedFixesMap } from "./helpers/buildIdentifiedFixesMap.js";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./helpers/buildPackagesMap.js";
import { collectDependents } from "./helpers/collectDependents.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { writeBunLockFile } from "./helpers/writeBunLockFile.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
export function fixDuplicates(dryRun = false) {
    const bunLockResult = readAndParseBunLock();
    const packages = parseBunLockPackages(bunLockResult);
    const packagesMap = buildPackagesMap(packages);
    const duplicatesPackagesMap = filterDuplicatesPackagesMap(packagesMap);
    const dependents = collectDependents(packages, bunLockResult.workspaces, Object.keys(duplicatesPackagesMap));
    const identifiedFixesMap = buildIdentifiedFixesMap(duplicatesPackagesMap, dependents);
    const result = applyIdentifiedFixesToBunLock(bunLockResult, identifiedFixesMap);
    if (result.changed) {
        if (dryRun) {
            console.log("Dry run: would update bun.lock for entries:", result.changedKeys.join(", "));
        }
        else {
            writeBunLockFile(bunLockResult);
            console.log("bun.lock updated");
            console.log("Please run `bun i` to apply the changes");
            console.log("If you want to format properly bun.lock again, you need to update a dependency", " eg (`bun update typescript && bun i`)");
        }
    }
    else {
        console.log("Nothing safe to dedupe identified");
    }
}
//# sourceMappingURL=fixDuplicates.js.map