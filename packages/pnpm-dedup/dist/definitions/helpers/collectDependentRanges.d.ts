import type { PnpmLockFile } from "../pnpmLockTypes.ts";
import type { ManifestReader } from "./readInstalledManifest.ts";
export interface DependentRange {
    key: string;
    range: string;
}
export type DependentRangesMap = Map<string, DependentRange[]>;
/**
 * Collect, for each duplicated package, the real semver range every dependent
 * declares. Direct (importer) dependents carry their specifier; transitive
 * dependents' ranges are read from their installed manifest (the pnpm lockfile
 * only stores the resolved version, not the range). When a manifest is missing
 * (project not installed), the resolved version is used as an exact fallback.
 */
export declare const collectDependentRanges: (lock: PnpmLockFile, duplicatePackageNames: Set<string>, readManifest: ManifestReader) => DependentRangesMap;
//# sourceMappingURL=collectDependentRanges.d.ts.map