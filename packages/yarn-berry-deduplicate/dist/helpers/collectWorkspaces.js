import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYarnDescriptor } from "./yarnDescriptor.js";
export const createManifestReader = (projectDir) => (workspacePath) => {
    try {
        return JSON.parse(readFileSync(join(projectDir, workspacePath, "package.json"), "utf8"));
    }
    catch {
        return undefined;
    }
};
const depTypes = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
];
const fromManifest = (manifest) => depTypes.flatMap((depType) => {
    const deps = manifest[depType];
    if (typeof deps !== "object" || deps === null)
        return [];
    return Object.entries(deps).map(([key, value]) => ({ key, value, depType }));
});
/**
 * Which dependency block a workspace declares a range in exists only in the
 * manifest: the lockfile folds a workspace's dependencies and devDependencies
 * into one `dependencies` map, and `applyWorkspaceRangeEdit` needs the block to
 * scope its edit. The lockfile is still what enumerates the workspaces, and it
 * still answers when a manifest cannot be read — with every range attributed to
 * `dependencies`, which is wrong often enough that such an edit is reported
 * unresolvable rather than applied.
 */
export const collectWorkspaces = (packages, readManifest) => {
    const workspaces = new Map();
    for (const yarnPackage of packages.values()) {
        if (yarnPackage.type !== "other" || yarnPackage.protocol !== "workspace") {
            continue;
        }
        const descriptor = parseYarnDescriptor(yarnPackage.resolution);
        const path = descriptor.selector === "." ? "" : descriptor.selector;
        if (workspaces.has(path))
            continue;
        const manifest = readManifest(path);
        workspaces.set(path, {
            path,
            name: yarnPackage.name,
            dependencies: manifest
                ? fromManifest(manifest)
                : Object.entries(yarnPackage.entry.dependencies ?? {}).map(([key, value]) => ({ key, value, depType: "dependencies" })),
        });
    }
    return [...workspaces.values()];
};
//# sourceMappingURL=collectWorkspaces.js.map