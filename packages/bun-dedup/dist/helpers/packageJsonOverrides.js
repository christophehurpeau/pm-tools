const indentOf = (content) => /\n(?<indent>[\t ]+)"/u.exec(content)?.groups?.indent ?? "  ";
/**
 * Add bun overrides to a workspace root `package.json`. The manifest is
 * reserialized rather than patched in place, which is only acceptable because
 * the overrides are transient: the original text is restored from the snapshot
 * once the resolution they force is verified.
 */
export const addOverrides = (content, overrides) => {
    const manifest = JSON.parse(content);
    manifest.overrides = {
        ...manifest.overrides,
        ...Object.fromEntries(overrides),
    };
    return `${JSON.stringify(manifest, null, indentOf(content))}\n`;
};
//# sourceMappingURL=packageJsonOverrides.js.map