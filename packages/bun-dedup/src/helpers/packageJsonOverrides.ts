const indentOf = (content: string): string =>
  /\n(?<indent>[\t ]+)"/u.exec(content)?.groups?.indent ?? "  ";

/**
 * Add bun overrides to a workspace root `package.json`. The manifest is
 * reserialized rather than patched in place, which is only acceptable because
 * the overrides are transient: the original text is restored from the snapshot
 * once the resolution they force is verified.
 */
export const addOverrides = (
  content: string,
  overrides: Map<string, string>,
): string => {
  const manifest = JSON.parse(content) as {
    overrides?: Record<string, string>;
  };

  manifest.overrides = {
    ...manifest.overrides,
    ...Object.fromEntries(overrides),
  };

  return `${JSON.stringify(manifest, null, indentOf(content))}\n`;
};
