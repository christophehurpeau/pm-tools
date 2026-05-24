export const PackageDescriptorNameUtils = {
    parse: (value) => {
        if (value.startsWith("@")) {
            const [scope, name] = value.slice(1).split("/", 2);
            if (`@${scope}/${name}` !== value) {
                throw new Error(`Invalid package name with scope: ${value} (expecting ${scope}/${name})`);
            }
            return { scope, name };
        }
        return { name: value };
    },
    stringify: (descriptor) => {
        return descriptor.scope === undefined
            ? descriptor.name
            : `@${descriptor.scope}/${descriptor.name}`;
    },
};
export const PackageDependencyDescriptorUtils = {
    make: (descriptor, selector) => {
        return {
            key: descriptor.key,
            npmName: descriptor.npmName,
            nameDescriptor: descriptor.nameDescriptor,
            selector,
        };
    },
    parse: (dependencyKey, dependencyValue) => {
        const [name, selector] = dependencyValue.startsWith("npm:")
            ? (() => {
                const v = dependencyValue.slice("npm:".length);
                if (!v.startsWith("@")) {
                    const [name, selector] = v.split("@", 2);
                    if (`${name}@${selector}` !== v) {
                        throw new Error(`Invalid npm package dependency: ${v}, expecting ${name}@${selector}`);
                    }
                    return [name, selector];
                }
                const [packageNameWithoutFirstChar, selector] = v
                    .slice(1)
                    .split("@", 2);
                if (`@${packageNameWithoutFirstChar}@${selector}` !== v) {
                    throw new Error(`Invalid npm package dependency: ${v}, expecting @${packageNameWithoutFirstChar}@${selector}`);
                }
                return [`@${packageNameWithoutFirstChar}`, selector];
            })()
            : [dependencyKey, dependencyValue];
        return {
            key: dependencyKey,
            npmName: name,
            nameDescriptor: PackageDescriptorNameUtils.parse(name),
            selector,
        };
    },
    stringify: (descriptor) => {
        return [
            descriptor.key,
            descriptor.npmName !== descriptor.key
                ? `npm:${descriptor.npmName}@${descriptor.selector}`
                : descriptor.selector,
        ];
    },
};
// export const PackageDependencySelectorUtils;
//# sourceMappingURL=packageDependenciesUtils.js.map