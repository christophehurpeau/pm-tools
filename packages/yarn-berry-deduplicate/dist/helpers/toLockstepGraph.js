import { PackageDependencyDescriptorUtils, isSemverComparable } from "pm-utils";
/**
 * An entry's `dependencies` map is keyed by the key the package declared, so an
 * aliased edge sits under the alias and points at another package. Cluster
 * detection matches edges against graph names, which are npm names, so the edge
 * has to be resolved first — `"semver-legacy": "npm:semver@^6.0.0"` is an edge
 * to `semver` ranged `^6.0.0`. Declarations semver cannot read constrain
 * nothing and are dropped rather than handed over as ranges.
 *
 * A package declaring the same npm name twice (`semver` and an aliased
 * `semver-legacy`) collapses onto one edge: the graph holds one range per name.
 * The direct declaration wins, being the one whose key the resolver keeps.
 */
const resolveDependencies = (dependencies) => {
    const resolved = {};
    for (const [depKey, depValue] of Object.entries(dependencies)) {
        const descriptor = PackageDependencyDescriptorUtils.parse(depKey, depValue);
        if (!isSemverComparable(descriptor))
            continue;
        if (descriptor.isAlias && resolved[descriptor.npmName] !== undefined) {
            continue;
        }
        resolved[descriptor.npmName] = descriptor.selector;
    }
    return resolved;
};
// Adapt the yarn lockfile model into the package-manager-neutral graph consumed
// by `buildLockstepClusters`. yarn stores the requested ranges in each entry's
// `dependencies`, so they map straight through once the keys are resolved.
export const toLockstepGraph = (packagesMap) => Object.fromEntries(Object.entries(packagesMap).map(([name, resolutions]) => [
    name,
    resolutions.map((resolution) => {
        const pkg = resolution.package;
        if (pkg.type !== "npm") {
            return { version: "", isNpm: false, dependencies: {} };
        }
        return {
            version: pkg.version,
            isNpm: true,
            dependencies: resolveDependencies(pkg.entry.dependencies ?? {}),
        };
    }),
]));
//# sourceMappingURL=toLockstepGraph.js.map