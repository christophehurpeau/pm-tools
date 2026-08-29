import type { Colorize, ReportStyle } from "./reportColors.ts";
/**
 * A package name in two tones: the scope one shade deeper than the name it
 * prefixes, so the half that identifies stays the readable one without the
 * other fading out.
 */
export declare const stylePackageName: (color: Colorize, name: string, styles?: ReportStyle[]) => string;
/**
 * A `name@version` reference. Anything without a version is returned untouched:
 * the reports also list requesters that are not packages at all, such as
 * `package.json in devDependencies`.
 */
export declare const stylePackageReference: (color: Colorize, reference: string) => string;
//# sourceMappingURL=packageStyles.d.ts.map