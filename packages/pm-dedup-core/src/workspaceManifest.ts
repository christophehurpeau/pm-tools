import semver from "semver";
import { PackageDependencyDescriptorUtils } from "./packageDependenciesUtils.ts";

export interface WorkspaceRangeEdit {
  // npm name of the dependency, which is not the manifest key for an alias
  packageName: string;
  depType: string;
  // the selector currently declared, as `collectDependentRanges` read it
  range: string;
  to: string;
}

/**
 * Keep the user's range style when it still expresses the same intent: a caret
 * or tilde range moved to the target line stays a caret or tilde range. Any
 * other shape (`*`, `0.83 - 0.86`, `>=1`) has no target-line equivalent, so the
 * exact version is the only faithful rewrite.
 */
export const nextSelector = (range: string, to: string): string => {
  const prefix = range.slice(0, 1);
  return (prefix === "^" || prefix === "~") && semver.valid(range.slice(1))
    ? `${prefix}${to}`
    : to;
};

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const findDepTypeBlock = (
  content: string,
  depType: string,
): { start: number; end: number } | undefined => {
  const header = new RegExp(`"${escapeRegExp(depType)}"\\s*:\\s*\\{`, "u").exec(
    content,
  );
  if (!header) return undefined;

  const start = header.index + header[0].length;
  let depth = 1;
  for (let index = start; index < content.length; index++) {
    const char = content[index];
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return { start, end: index };
    }
  }
  return undefined;
};

const manifestKeyOf = (
  deps: Record<string, string>,
  packageName: string,
  range: string,
): string | undefined =>
  Object.entries(deps).find(([key, value]) => {
    const parsed = PackageDependencyDescriptorUtils.parse(key, value);
    return parsed.npmName === packageName && parsed.selector === range;
  })?.[0];

/**
 * Rewrite one declared range in a workspace `package.json`, as a targeted edit
 * on the raw text: reserializing would reformat a file the tool does not own.
 * Returns `undefined` when the declaration is not there any more, which is the
 * caller's signal that the lockfile it read from is stale.
 */
export const applyWorkspaceRangeEdit = (
  content: string,
  edit: WorkspaceRangeEdit,
): string | undefined => {
  const manifest = JSON.parse(content) as Record<
    string,
    Record<string, string> | undefined
  >;
  const deps = manifest[edit.depType];
  if (!deps) return undefined;

  const manifestKey = manifestKeyOf(deps, edit.packageName, edit.range);
  if (manifestKey === undefined) return undefined;

  const block = findDepTypeBlock(content, edit.depType);
  if (!block) return undefined;

  const [, declared] = PackageDependencyDescriptorUtils.stringify(
    PackageDependencyDescriptorUtils.make(
      PackageDependencyDescriptorUtils.parse(manifestKey, deps[manifestKey]!),
      nextSelector(edit.range, edit.to),
    ),
  );

  const declaration = new RegExp(
    `("${escapeRegExp(manifestKey)}"\\s*:\\s*)"[^"]*"`,
    "u",
  );
  const slice = content.slice(block.start, block.end);
  const updated = slice.replace(declaration, `$1${JSON.stringify(declared)}`);
  if (updated === slice) return undefined;

  return content.slice(0, block.start) + updated + content.slice(block.end);
};
