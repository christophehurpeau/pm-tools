import { PackageDependencyDescriptorUtils } from "pm-utils";
export function collectDependents(packages, workspaces, onlyPackageNames) {
    const dependentsMap = new Map();
    const iterateDependencies = (dependencies, key, bunPackage) => {
        for (const [depName, depVersion] of Object.entries(dependencies)) {
            const parsedDep = PackageDependencyDescriptorUtils.parse(depName, depVersion);
            if (onlyPackageNames && !onlyPackageNames.includes(parsedDep.npmName)) {
                continue;
            }
            let dependentPackage = dependentsMap.get(parsedDep.npmName);
            if (!dependentPackage) {
                dependentPackage = [];
                dependentsMap.set(parsedDep.npmName, dependentPackage);
            }
            dependentPackage.push({ key, version: depVersion, bunPackage });
        }
    };
    for (const [workspacePath, workspacePackage] of Object.entries(workspaces)) {
        ["dependencies", "devDependencies"].forEach((depType) => {
            const deps = workspacePackage[depType];
            if (deps) {
                iterateDependencies(deps, `${workspacePath === "" ? "package.json" : workspacePath} in ${depType}`);
            }
        });
    }
    for (const [key, pkg] of packages.entries()) {
        if (pkg.type === "root" || pkg.type === "workspace")
            continue;
        if (!pkg.info.dependencies)
            continue;
        iterateDependencies(pkg.info.dependencies, key, pkg);
    }
    return dependentsMap;
}
//# sourceMappingURL=collectDependents.js.map