const indentOf = (content: string): string =>
  /\n(?<indent>[\t ]+)"/u.exec(content)?.groups?.indent ?? "  ";

/**
 * Add yarn resolutions to a workspace root `package.json`. The manifest is
 * reserialized rather than patched in place, which is only acceptable because
 * the resolutions are transient: the original text is restored from the
 * snapshot once the resolution they force is verified.
 */
export const addResolutions = (
  content: string,
  resolutions: Map<string, string>,
): string => {
  const manifest = JSON.parse(content) as {
    resolutions?: Record<string, string>;
  };

  manifest.resolutions = {
    ...manifest.resolutions,
    ...Object.fromEntries(resolutions),
  };

  return `${JSON.stringify(manifest, null, indentOf(content))}\n`;
};
