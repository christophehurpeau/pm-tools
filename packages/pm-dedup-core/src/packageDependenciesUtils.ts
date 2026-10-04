import semver from "semver";

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

/**
 * `git+ssh` and `https` keep their whole prefix rather than collapsing to `git`
 * or being dropped: the round trip through `stringify` has to reproduce the
 * declaration byte for byte, and nothing downstream branches on which flavour
 * of git url it is.
 */
const protocolPattern = /^([a-z][a-z0-9+.-]*):/u;

interface ExtractedProtocol {
  protocol: string | undefined;
  rest: string;
}

const extractProtocol = (dependencyValue: string): ExtractedProtocol => {
  const match = protocolPattern.exec(dependencyValue);
  if (!match) return { protocol: undefined, rest: dependencyValue };
  return { protocol: match[1]!, rest: dependencyValue.slice(match[0].length) };
};

interface AliasParts {
  npmName: string;
  selector: string;
}

/**
 * An `npm:` value is either a range (`npm:^1.0.0`, yarn's spelling) or an alias
 * naming another package (`npm:semver@^6.0.0`, `npm:@types/bun`). Semver tells
 * them apart: an alias target is never a valid range. A nameless alias keeps an
 * empty selector, which `semver` already reads as `*`.
 */
const parseAlias = (rest: string): AliasParts | undefined => {
  if (semver.validRange(rest) !== null) return undefined;

  const separatorIndex = rest.startsWith("@")
    ? rest.indexOf("@", 1)
    : rest.indexOf("@");

  return separatorIndex === -1
    ? { npmName: rest, selector: "" }
    : {
        npmName: rest.slice(0, separatorIndex),
        selector: rest.slice(separatorIndex + 1),
      };
};

export const PackageDependencyDescriptorUtils = {
  make: <Protocol extends string>(
    descriptor: PackageDependencyDescriptor<Protocol>,
    selector: string,
  ): PackageDependencyDescriptor<Protocol> => ({ ...descriptor, selector }),

  /**
   * The `Protocol` union declares what a given lockfile can contain; `parse`
   * does not enforce it. An unknown protocol has to parse, because
   * `manifestKeyOf` reads every sibling declaration in a dependency block to
   * find the one it edits — throwing on a neighbour would abort an unrelated
   * rewrite. It still lands in `protocol` rather than being folded into the
   * selector, so `isNpmProtocol` keeps it out of the npm comparisons.
   */
  parse: <Protocol extends string = string>(
    dependencyKey: string,
    dependencyValue: string,
  ): PackageDependencyDescriptor<Protocol> => {
    const { protocol, rest } = extractProtocol(dependencyValue);
    const alias = protocol === "npm" ? parseAlias(rest) : undefined;
    const npmName = alias?.npmName ?? dependencyKey;

    return {
      key: dependencyKey,
      npmName,
      nameDescriptor: PackageDescriptorNameUtils.parse(npmName),
      protocol: protocol as Protocol | undefined,
      isAlias: alias !== undefined,
      selector: alias?.selector ?? rest,
    };
  },

  stringify: ({
    key,
    npmName,
    protocol,
    isAlias,
    selector,
  }: PackageDependencyDescriptor): [key: string, value: string] => {
    const target = (() => {
      if (!isAlias) return selector;
      return selector === "" ? npmName : `${npmName}@${selector}`;
    })();

    return [key, protocol === undefined ? target : `${protocol}:${target}`];
  },
};

export const isNpmProtocol = (protocol: string | undefined): boolean =>
  protocol === undefined || protocol === "npm";

/**
 * The guard to use before handing a selector to semver. A protocol check alone
 * is not enough: shorthand declarations carry no prefix at all (`user/repo`,
 * `./local`, `git@host:o/r.git`) and would otherwise read as npm ranges.
 */
export const isSemverComparable = (
  descriptor: PackageDependencyDescriptor,
): boolean =>
  isNpmProtocol(descriptor.protocol) &&
  semver.validRange(descriptor.selector) !== null;
