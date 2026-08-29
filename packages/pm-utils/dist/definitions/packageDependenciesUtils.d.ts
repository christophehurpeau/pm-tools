/**
 * Combination of an optional scope and name.
 *
 * eg `@npm/types`
 */
export interface PackageDescriptorName {
    scope?: string;
    name: string;
}
interface DescriptorUtils<Descriptor> {
    parse: (value: string) => Descriptor;
    stringify: (descriptor: Descriptor) => string;
}
export declare const PackageDescriptorNameUtils: DescriptorUtils<PackageDescriptorName>;
export interface PackageDependencyDescriptor<Protocol extends string = string> {
    key: string;
    npmName: string;
    nameDescriptor: PackageDescriptorName;
    /** `undefined` when the value is declared bare (`^1.0.0`), which means npm */
    protocol: Protocol | undefined;
    /** the npm name comes from the value (`npm:other@^1`), not from the key */
    isAlias: boolean;
    /** protocol removed: `^1.0.0` for `npm:^1.0.0`, `*` for `workspace:*` */
    selector: string;
}
export declare const PackageDependencyDescriptorUtils: {
    make: <Protocol extends string>(descriptor: PackageDependencyDescriptor<Protocol>, selector: string) => PackageDependencyDescriptor<Protocol>;
    /**
     * The `Protocol` union declares what a given lockfile can contain; `parse`
     * does not enforce it. An unknown protocol has to parse, because
     * `manifestKeyOf` reads every sibling declaration in a dependency block to
     * find the one it edits — throwing on a neighbour would abort an unrelated
     * rewrite. It still lands in `protocol` rather than being folded into the
     * selector, so `isNpmProtocol` keeps it out of the npm comparisons.
     */
    parse: <Protocol extends string = string>(dependencyKey: string, dependencyValue: string) => PackageDependencyDescriptor<Protocol>;
    stringify: ({ key, npmName, protocol, isAlias, selector, }: PackageDependencyDescriptor) => [key: string, value: string];
};
export declare const isNpmProtocol: (protocol: string | undefined) => boolean;
/**
 * The guard to use before handing a selector to semver. A protocol check alone
 * is not enough: shorthand declarations carry no prefix at all (`user/repo`,
 * `./local`, `git@host:o/r.git`) and would otherwise read as npm ranges.
 */
export declare const isSemverComparable: (descriptor: PackageDependencyDescriptor) => boolean;
export {};
//# sourceMappingURL=packageDependenciesUtils.d.ts.map