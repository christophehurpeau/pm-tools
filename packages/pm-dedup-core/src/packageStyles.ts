import type { Colorize, ReportStyle } from "./reportColors.ts";

/**
 * A package name in two tones: the scope one shade deeper than the name it
 * prefixes, so the half that identifies stays the readable one without the
 * other fading out.
 */
export const stylePackageName = (
  color: Colorize,
  name: string,
  styles: ReportStyle[] = ["packageName"],
): string => {
  // 0 when unscoped, since indexOf returns -1
  const scopeEnd = name.startsWith("@") ? name.indexOf("/") + 1 : 0;
  if (scopeEnd === 0) return color(styles, name);
  const scopeStyles = styles.map((style) =>
    style === "packageName" ? "scope" : style,
  );
  return `${color(scopeStyles, name.slice(0, scopeEnd))}${color(styles, name.slice(scopeEnd))}`;
};

// The version part of `name@version`, past the scope's own `@`. Yarn's
// `lodash@npm:4.17.21` and pnpm's `metro@0.84.5(react@19)` both split here.
const versionStart = (reference: string): number => {
  const nameStart = reference.startsWith("@") ? reference.indexOf("/") + 1 : 0;
  if (nameStart === 0 && reference.startsWith("@")) return -1;
  return reference.indexOf("@", nameStart);
};

/**
 * A `name@version` reference. Anything without a version is returned untouched:
 * the reports also list requesters that are not packages at all, such as
 * `package.json in devDependencies`.
 */
export const stylePackageReference = (
  color: Colorize,
  reference: string,
): string => {
  const at = versionStart(reference);
  if (at <= 0) return reference;
  return `${stylePackageName(color, reference.slice(0, at))}${color("yellow", reference.slice(at))}`;
};
