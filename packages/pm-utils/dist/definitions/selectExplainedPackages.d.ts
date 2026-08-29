import type { PackageFilter } from "./createPackageFilter.ts";
import type { DuplicatesReportTitle } from "./renderDuplicatesReport.ts";
export interface SelectExplainedPackagesOptions<Resolutions extends readonly unknown[]> {
    packagesMap: Record<string, Resolutions>;
    filter: PackageFilter;
    all: boolean;
}
export interface ExplainedPackagesSelection<Resolutions extends readonly unknown[]> {
    packages: Record<string, Resolutions>;
    title: DuplicatesReportTitle;
    notice: string | undefined;
}
/**
 * The packages a `why-duplicate` run reports on. Naming a package is asking why
 * it is duplicated, and the honest answer to "it is not" is its dependents, not
 * an empty report: a selection holding no duplicate is kept whole, and the
 * notice says why it is being shown.
 *
 * `--all` asks for that unconditionally, so it never needs the fallback.
 */
export declare const selectExplainedPackages: <Resolutions extends readonly unknown[]>({ packagesMap, filter, all, }: SelectExplainedPackagesOptions<Resolutions>) => ExplainedPackagesSelection<Resolutions>;
//# sourceMappingURL=selectExplainedPackages.d.ts.map