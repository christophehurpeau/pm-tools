import type { PackageFilterOptions } from "./createPackageFilter.ts";
export declare const packageFilterParseArgsOptions: {
    readonly packages: {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly scopes: {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly exclude: {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly "exclude-scopes": {
        readonly type: "string";
        readonly multiple: true;
    };
};
export declare const packageFilterUsage = "  --packages <names>           only these packages, as names or globs\n  --scopes <scopes>            only these scopes\n  --exclude <names>            never these packages\n  --exclude-scopes <scopes>    never these scopes\n\nEvery filter flag takes a comma list, or is repeated.";
export interface PackageFilterArgValues {
    packages?: string[];
    scopes?: string[];
    exclude?: string[];
    "exclude-scopes"?: string[];
}
export declare const toPackageFilterOptions: (values: PackageFilterArgValues) => PackageFilterOptions;
export declare const whyDuplicateParseArgsOptions: {
    readonly packages: {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly scopes: {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly exclude: {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly "exclude-scopes": {
        readonly type: "string";
        readonly multiple: true;
    };
    readonly all: {
        readonly type: "boolean";
        readonly short: "a";
    };
    readonly details: {
        readonly type: "boolean";
        readonly short: "d";
    };
};
export declare const whyDuplicateUsage = "  -a, --all                    keep packages that are not duplicated\n  -d, --details                every dependent of every version, not one line each\n\n  --packages <names>           only these packages, as names or globs\n  --scopes <scopes>            only these scopes\n  --exclude <names>            never these packages\n  --exclude-scopes <scopes>    never these scopes\n\nEvery filter flag takes a comma list, or is repeated.";
export interface WhyDuplicateArgValues extends PackageFilterArgValues {
    all?: boolean;
    details?: boolean;
}
export interface WhyDuplicateRequest {
    filter: PackageFilterOptions;
    explains: boolean;
    all: boolean;
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
export declare const toWhyDuplicateRequest: (values: WhyDuplicateArgValues, positionals: string[]) => WhyDuplicateRequest;
//# sourceMappingURL=packageFilterArgs.d.ts.map