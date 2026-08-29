import { PackageDependencyDescriptorUtils } from "pm-utils";
/**
 * A yarn.lock key holds descriptors as one string, `name@protocol:selector`,
 * where every other lockfile in this repo stores the name and the value apart.
 * Splitting on the separating `@` recovers that pair, which `pm-utils` already
 * knows how to read — including the alias form
 * `psc@npm:printable-shell-command@^5.0.0`, whose requested range is the
 * target's `^5.0.0` and not the whole selector.
 */
const splitDescriptorString = (descriptorString) => {
    const separatorIndex = descriptorString.startsWith("@")
        ? descriptorString.indexOf("@", 1)
        : descriptorString.indexOf("@");
    if (separatorIndex === -1) {
        throw new Error(`Invalid yarn descriptor without range: ${descriptorString}`);
    }
    return [
        descriptorString.slice(0, separatorIndex),
        descriptorString.slice(separatorIndex + 1),
    ];
};
export const parseYarnDescriptor = (descriptorString) => PackageDependencyDescriptorUtils.parse(...splitDescriptorString(descriptorString));
// yarn writes a lockfile key as the descriptors it covers, comma-separated
export const splitEntryKey = (entryKey) => entryKey.split(", ").map((part) => part.trim());
//# sourceMappingURL=yarnDescriptor.js.map