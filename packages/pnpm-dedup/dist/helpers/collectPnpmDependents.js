import { PackageDependencyDescriptorUtils } from "pm-utils";
import { parsePackageId, stripPeerSuffix } from "./parsePnpmLockPackages.js";
const importerDepTypes = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
];
const snapshotDepTypes = ["dependencies", "optionalDependencies"];
// In a snapshot, a dependency value is either a resolved version (`1.2.3`,
// possibly peer-suffixed) for which the key is the real npm name, or an aliased
// `realName@version` form when the key is a local alias.
const resolveSnapshotDependency = (depName, depValue) => {
    const stripped = stripPeerSuffix(depValue);
    if (/^\d/.test(stripped)) {
        return { name: depName, version: stripped };
    }
    const { name, version } = parsePackageId(stripped);
    return { name: name || depName, version };
};
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