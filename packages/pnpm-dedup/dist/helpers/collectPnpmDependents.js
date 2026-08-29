import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
import { parsePackageId, resolveSnapshotDependency, } from "./parsePnpmLockPackages.js";
const importerDepTypes = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
];
const snapshotDepTypes = ["dependencies", "optionalDependencies"];
export function collectPnpmDependents(lock, onlyPackageNames) {
    const dependentsMap = new Map();
    const add = (name, dependent) => {
        if (onlyPackageNames && !onlyPackageNames.includes(name)) {
            return;
        }
        let dependents = dependentsMap.get(name);
        if (!dependents) {
            dependents = [];
            dependentsMap.set(name, dependents);
        }
        dependents.push(dependent);
    };
    for (const [importerPath, project] of Object.entries(lock.importers ?? {})) {
        importerDepTypes.forEach((depType) => {
            const deps = project[depType];
            if (!deps)
                return;
            for (const [depName, { specifier }] of Object.entries(deps)) {
                const parsedDep = PackageDependencyDescriptorUtils.parse(depName, specifier);
                // `workspace:` and `catalog:` name something other than the npm package
                // sharing this key, so they constrain no npm version
                if (!isSemverComparable(parsedDep))
                    continue;
                add(parsedDep.npmName, {
                    key: `${importerPath === "." ? "package.json" : importerPath} in ${depType}`,
                    version: parsedDep.selector,
                });
            }
        });
    }
    for (const [snapshotKey, snapshot] of Object.entries(lock.snapshots ?? {})) {
        const { name, version } = parsePackageId(snapshotKey);
        const key = `${name}@${version}`;
        snapshotDepTypes.forEach((depType) => {
            const deps = snapshot[depType];
            if (!deps)
                return;
            for (const [depName, depValue] of Object.entries(deps)) {
                const resolved = resolveSnapshotDependency(depName, depValue);
                add(resolved.name, { key, version: resolved.version });
            }
        });
    }
    return dependentsMap;
}
//# sourceMappingURL=collectPnpmDependents.js.map