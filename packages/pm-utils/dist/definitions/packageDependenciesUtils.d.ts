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
export interface PackageDependencyDescriptor {
    key: string;
    npmName: string;
    nameDescriptor: PackageDescriptorName;
    selector: string;
}
interface PackageDependencyDescriptorUtils<Descriptor = PackageDependencyDescriptor> {
    make: (descriptor: Descriptor, selector: string) => Descriptor;
    parse: (dependencyKey: string, dependencyValue: string) => Descriptor;
    stringify: (descriptor: Descriptor) => [key: string, value: string];
}
export declare const PackageDependencyDescriptorUtils: PackageDependencyDescriptorUtils;
export {};
//# sourceMappingURL=packageDependenciesUtils.d.ts.map