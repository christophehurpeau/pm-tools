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

export const PackageDescriptorNameUtils: DescriptorUtils<PackageDescriptorName> =
  {
    parse: (value) => {
      if (value.startsWith("@")) {
        const [scope, name] = value.slice(1).split("/", 2) as [string, string];
        if (`@${scope}/${name}` !== value) {
          throw new Error(
            `Invalid package name with scope: ${value} (expecting ${scope}/${name})`,
          );
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

export interface PackageDependencyDescriptor {
  key: string;
  npmName: string;
  nameDescriptor: PackageDescriptorName;
  selector: string; // can be npm tag or version or version range or git url or local folder path
}

interface PackageDependencyDescriptorUtils<
  Descriptor = PackageDependencyDescriptor,
> {
  make: (descriptor: Descriptor, selector: string) => Descriptor;
  parse: (dependencyKey: string, dependencyValue: string) => Descriptor;
  stringify: (descriptor: Descriptor) => [key: string, value: string];
}

export const PackageDependencyDescriptorUtils: PackageDependencyDescriptorUtils =
  {
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
              const [name, selector] = v.split("@", 2) as [string, string];
              if (`${name}@${selector}` !== v) {
                throw new Error(
                  `Invalid npm package dependency: ${v}, expecting ${name}@${selector}`,
                );
              }
              return [name, selector];
            }
            const [packageNameWithoutFirstChar, selector] = v
              .slice(1)
              .split("@", 2) as [string, string];
            if (`@${packageNameWithoutFirstChar}@${selector}` !== v) {
              throw new Error(
                `Invalid npm package dependency: ${v}, expecting @${packageNameWithoutFirstChar}@${selector}`,
              );
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
