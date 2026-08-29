import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
// Path segments are the keys their parent declared, so an aliased dependency
// sits under the alias, not under its own name. Dropping one segment means
// dropping one declared key: two parts when it is scoped, one otherwise.
const parentPathOf = (path) => {
    const segments = path.split("/");
    return segments
        .slice(0, segments.at(-2)?.startsWith("@") ? -2 : -1)
        .join("/");
};
const resolveInstalledPackage = ({ packages, requesterPath, depKey, npmName, }) => {
    const packageAt = (key) => {
        const pkg = packages.get(key);
        return pkg?.name === npmName ? pkg : undefined;
    };
    let path = requesterPath;
    while (path !== "") {
        const found = packageAt(`${path}/${depKey}`);
        if (found !== undefined)
            return found;
        path = parentPathOf(path);
    }
    return packageAt(depKey);
};
export function collectDependents(packages, workspaces, onlyPackageNames) {
    const dependentsMap = new Map();
    const iterateDependencies = (dependencies, key, bunPackage, workspace, 
    // install path of the requester, for the resolved-version lookup
    lookupPath = "") => {
        for (const [depName, depVersion] of Object.entries(dependencies)) {
            const parsedDep = PackageDependencyDescriptorUtils.parse(depName, depVersion);
            if (onlyPackageNames && !onlyPackageNames.includes(parsedDep.npmName)) {
                continue;
            }
            // A `workspace:`, `file:` or git declaration names a different package
            // that happens to share this key, so it constrains no npm version, and it
            // is flagged rather than read as a range: taken as one,
            // `semver.satisfies` would answer "not satisfied" for every candidate and
            // suppress the merges the real dependents allow. It is still recorded —
            // such a copy is a resolution of its own in the report, and dropping the
            // only declaration that asks for it leaves that copy with no explanation
            // at all. The declaration is kept as written, protocol included, there
            // being no range to keep instead.
            const nonSemver = isSemverComparable(parsedDep) ? undefined : true;
            let dependentPackage = dependentsMap.get(parsedDep.npmName);
            if (!dependentPackage) {
                dependentPackage = [];
                dependentsMap.set(parsedDep.npmName, dependentPackage);
            }
            const resolved = resolveInstalledPackage({
                packages,
                requesterPath: lookupPath,
                depKey: parsedDep.key,
                npmName: parsedDep.npmName,
            });
            dependentPackage.push({
                key,
                version: nonSemver
                    ? PackageDependencyDescriptorUtils.stringify(parsedDep)[1]
                    : parsedDep.selector,
                aliasKey: parsedDep.isAlias ? parsedDep.key : undefined,
                bunPackage,
                workspace,
                resolvedVersion: resolved?.type === "npm" ? resolved.version : undefined,
                resolvedResolution: resolved && resolved.type !== "npm" ? resolved.resolution : undefined,
                nonSemver,
            });
        }
    };
    for (const [workspacePath, workspacePackage] of Object.entries(workspaces)) {
        ["dependencies", "devDependencies"].forEach((depType) => {
            const deps = workspacePackage[depType];
            if (deps) {
                iterateDependencies(deps, `${workspacePath === "" ? "package.json" : workspacePath} in ${depType}`, undefined, { path: workspacePath, depType }, 
                // a nested copy under a workspace is keyed by the workspace *name*,
                // not its directory; the root's own deps are the top-level keys
                workspacePath === "" ? "" : (workspacePackage.name ?? ""));
            }
        });
    }
    for (const [key, pkg] of packages.entries()) {
        if (pkg.type === "root" || pkg.type === "workspace")
            continue;
        if (!pkg.info.dependencies)
            continue;
        iterateDependencies(pkg.info.dependencies, key, pkg, undefined, key);
    }
    return dependentsMap;
}
//# sourceMappingURL=collectDependents.js.map