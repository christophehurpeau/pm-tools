import type { PackageFilter } from "./createPackageFilter.ts";
import type { DuplicatesReportTitle } from "./renderDuplicatesReport.ts";
import { listText, plural } from "./reportText.ts";

export interface SelectExplainedPackagesOptions<
  Resolutions extends readonly unknown[],
> {
  // every package the lockfile holds, keyed by name
  packagesMap: Record<string, Resolutions>;
  filter: PackageFilter;
  // keeps packages the lockfile resolves only once, which a listing drops
  all: boolean;
}

export interface ExplainedPackagesSelection<
  Resolutions extends readonly unknown[],
> {
  packages: Record<string, Resolutions>;
  title: DuplicatesReportTitle;
  // headline replacing "No duplicates found", for the selection kept for its
  // dependents alone
  notice: string | undefined;
}

const singleVersionNotice = (names: string[]): string => {
  const shown = listText({
    items: names,
    more: (rest) => `, +${rest} more`,
  });
  return names.length === 1
    ? `${shown} is not duplicated. Showing its dependents:`
    : `None of the ${plural(names.length, "match", "matches")} is duplicated (${shown}). Showing their dependents:`;
};

/**
 * The packages a `why-duplicate` run reports on. Naming a package is asking why
 * it is duplicated, and the honest answer to "it is not" is its dependents, not
 * an empty report: a selection holding no duplicate is kept whole, and the
 * notice says why it is being shown.
 *
 * `--all` asks for that unconditionally, so it never needs the fallback.
 */
export const selectExplainedPackages = <
  Resolutions extends readonly unknown[],
>({
  packagesMap,
  filter,
  all,
}: SelectExplainedPackagesOptions<Resolutions>): ExplainedPackagesSelection<Resolutions> => {
  const selected = Object.entries(packagesMap).filter(([packageName]) =>
    filter.selects(packageName),
  );

  if (all) {
    return {
      packages: Object.fromEntries(selected),
      title: "matches",
      notice: undefined,
    };
  }

  const duplicated = selected.filter(
    ([, resolutions]) => resolutions.length > 1,
  );

  if (duplicated.length > 0 || selected.length === 0) {
    return {
      packages: Object.fromEntries(duplicated),
      title: "duplicates",
      notice: undefined,
    };
  }

  return {
    packages: Object.fromEntries(selected),
    title: "matches",
    notice: singleVersionNotice(selected.map(([packageName]) => packageName)),
  };
};
