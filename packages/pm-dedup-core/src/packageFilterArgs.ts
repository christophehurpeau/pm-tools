import type { PackageFilterOptions } from "./createPackageFilter.ts";

// `node:util` parseArgs shape, spread into a bin's own options so the four
// filter flags read the same whatever the package manager.
export const packageFilterParseArgsOptions = {
  packages: { type: "string", multiple: true },
  scopes: { type: "string", multiple: true },
  exclude: { type: "string", multiple: true },
  "exclude-scopes": { type: "string", multiple: true },
} as const;

// the `--help` block for the flags above, so every tool documents them alike
export const packageFilterUsage = `  --packages <names>           only these packages, as names or globs
  --scopes <scopes>            only these scopes
  --exclude <names>            never these packages
  --exclude-scopes <scopes>    never these scopes

Every filter flag takes a comma list, or is repeated.`;

export interface PackageFilterArgValues {
  packages?: string[];
  scopes?: string[];
  exclude?: string[];
  "exclude-scopes"?: string[];
}

// A repeated flag is how parseArgs collects several values; a comma list is what
// people type. Both mean the same thing here.
const toNames = (values: string[] | undefined): string[] | undefined => {
  if (!values) return undefined;
  const names = values
    .flatMap((value) => value.split(","))
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return names.length > 0 ? names : undefined;
};

export const toPackageFilterOptions = (
  values: PackageFilterArgValues,
): PackageFilterOptions => ({
  include: toNames(values.packages),
  includeScopes: toNames(values.scopes),
  exclude: toNames(values.exclude),
  excludeScopes: toNames(values["exclude-scopes"]),
});

// the two flags every `why-duplicate` bin takes on top of the filters
export const whyDuplicateParseArgsOptions = {
  all: { type: "boolean", short: "a" },
  details: { type: "boolean", short: "d" },
  ...packageFilterParseArgsOptions,
} as const;

export const whyDuplicateUsage = `  -a, --all                    keep packages that are not duplicated
  -d, --details                every dependent of every version, not one line each

${packageFilterUsage}`;

export interface WhyDuplicateArgValues extends PackageFilterArgValues {
  all?: boolean;
  details?: boolean;
}

export interface WhyDuplicateRequest {
  filter: PackageFilterOptions;
  // false lists the whole lockfile instead of explaining a selection
  explains: boolean;
  all: boolean;
  // the whole tree rather than one line per package
  details: boolean;
}

/**
 * The positional a `why-duplicate` bin takes is the short form of `--packages`.
 * Naming something to explain is what separates the two reports: without it
 * there is nothing to be `--all` about, and the whole lockfile is listed.
 *
 * Naming one is also asking why it is duplicated, which the one-line form does
 * not answer — so an explained selection is detailed unless it is a listing.
 */
export const toWhyDuplicateRequest = (
  values: WhyDuplicateArgValues,
  positionals: string[],
): WhyDuplicateRequest => {
  const filter = toPackageFilterOptions(values);
  const include = [...(filter.include ?? []), ...positionals];
  const explains = include.length > 0 || filter.includeScopes !== undefined;

  return {
    filter: {
      ...filter,
      include: include.length > 0 ? include : undefined,
    },
    explains,
    all: values.all ?? false,
    details: values.details === true || explains,
  };
};
