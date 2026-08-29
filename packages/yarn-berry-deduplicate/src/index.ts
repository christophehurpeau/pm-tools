import {
  buildIdentifiedFixesMap,
  countDuplicatedPackages,
  createPackageFilter,
  diffVersionsSnapshots,
  renderApplyPlan,
  renderDedupeSummary,
  selectExplainedPackages,
  selectPackages,
} from "pm-utils";
import type { PackageFilterOptions, VersionsSnapshot } from "pm-utils";
import { applyClusterFixes } from "./applyClusterFixes.ts";
import { displayMany } from "./displayMany.ts";
import { applyIdentifiedFixesToYarnLock } from "./helpers/applyIdentifiedFixesToYarnLock.ts";
import {
  buildYarnPackagesMap,
  filterDuplicatesYarnPackagesMap,
} from "./helpers/buildYarnPackagesMap.ts";
import {
  collectWorkspaces,
  createManifestReader,
} from "./helpers/collectWorkspaces.ts";
import { collectYarnDependents } from "./helpers/collectYarnDependents.ts";
import { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.ts";
import { lockPathOf, resolveYarnProjectDir } from "./helpers/projectDir.ts";
import {
  readVersionsSnapshot,
  versionsSnapshotOf,
} from "./helpers/versionsSnapshot.ts";
import { writeYarnLockFile } from "./helpers/writeYarnLockFile.ts";
import { identifyClusterFixes } from "./identifyClusterFixes.ts";
import { readAndParseYarnLock } from "./readYarnLock.ts";

export { displayMany } from "./displayMany.ts";
export { applyClusterFixes } from "./applyClusterFixes.ts";
export { identifyClusterFixes } from "./identifyClusterFixes.ts";
export { readAndParseYarnLock } from "./readYarnLock.ts";
export { parseYarnLock, stringifyYarnLock } from "./helpers/syml.ts";
export type { YarnEntries, YarnEntry } from "./helpers/syml.ts";
export { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.ts";
export type {
  YarnLockPackages,
  YarnNpmPackage,
  YarnOtherPackage,
  YarnPackage,
} from "./helpers/parseYarnLockPackages.ts";
export {
  buildYarnPackagesMap,
  filterDuplicatesYarnPackagesMap,
} from "./helpers/buildYarnPackagesMap.ts";
export type {
  PackageResolution,
  PackagesMap,
} from "./helpers/buildYarnPackagesMap.ts";
export {
  collectWorkspaces,
  createManifestReader,
} from "./helpers/collectWorkspaces.ts";
export type { ManifestReader, Workspace } from "./helpers/collectWorkspaces.ts";
export { collectYarnDependents } from "./helpers/collectYarnDependents.ts";
export type {
  Dependent,
  DependentsMap,
} from "./helpers/collectYarnDependents.ts";
export { toLockstepGraph } from "./helpers/toLockstepGraph.ts";
export {
  readVersionsSnapshot,
  versionsSnapshotOf,
} from "./helpers/versionsSnapshot.ts";
export { applyIdentifiedFixesToYarnLock } from "./helpers/applyIdentifiedFixesToYarnLock.ts";
export { writeYarnLockFile } from "./helpers/writeYarnLockFile.ts";
export { identifyResolutionFixes } from "pm-utils";
export type { ResolutionFix } from "pm-utils";

interface ReadProjectResult {
  entries: ReturnType<typeof readAndParseYarnLock>;
  packages: ReturnType<typeof parseYarnLockPackages>;
  packagesMap: ReturnType<typeof buildYarnPackagesMap>;
  workspaces: ReturnType<typeof collectWorkspaces>;
}

const readProject = (projectDir: string): ReadProjectResult => {
  const entries = readAndParseYarnLock(lockPathOf(projectDir));
  const packages = parseYarnLockPackages(entries);
  return {
    entries,
    packages,
    packagesMap: buildYarnPackagesMap(packages),
    workspaces: collectWorkspaces(packages, createManifestReader(projectDir)),
  };
};

export interface WhyDuplicateOptions {
  filter?: PackageFilterOptions;
  // keeps packages the lockfile resolves only once, which a listing drops
  all?: boolean;
  // every dependent of every version, instead of one line per package
  details?: boolean;
}

export function whyDuplicate({
  filter: filterOptions,
  all = false,
  details = false,
}: WhyDuplicateOptions): void {
  const filter = createPackageFilter(filterOptions);
  const projectDir = resolveYarnProjectDir();
  if (projectDir === null) return;
  const { packages, packagesMap, workspaces } = readProject(projectDir);

  const {
    packages: filteredPackages,
    title,
    notice,
  } = selectExplainedPackages({ packagesMap, filter, all });

  const dependents = collectYarnDependents({
    packages,
    workspaces,
    onlyPackageNames: Object.keys(filteredPackages),
  });

  // A duplicate is often only explainable by its family: show the cluster fixes
  // covering the matched packages, not just their own dependents.
  const matchedClusterFixes = identifyClusterFixes(
    packagesMap,
    packages,
    workspaces,
  ).filter((fix) => fix.members.some(filter.selects));

  displayMany({
    title,
    notice,
    duplicatesPackagesMap: filteredPackages,
    dependents,
    // the whole lockfile, so the count means the same whatever the filter
    totalDependencies: Object.keys(packagesMap).length,
    // the same fixes the listing shows: explaining one package is no reason to
    // stay silent on what would collapse it
    identifiedFixesMap: buildIdentifiedFixesMap(filteredPackages, dependents),
    clusterFixes: matchedClusterFixes,
    details,
  });
}

export interface ListDuplicatesOptions {
  filter?: PackageFilterOptions;
  details?: boolean;
}

export function listDuplicates({
  filter: filterOptions,
  details = false,
}: ListDuplicatesOptions = {}): void {
  const filter = createPackageFilter(filterOptions);
  const projectDir = resolveYarnProjectDir();
  if (projectDir === null) return;
  const { packages, packagesMap, workspaces } = readProject(projectDir);

  const duplicatesPackagesMap = selectPackages(
    filterDuplicatesYarnPackagesMap(packagesMap),
    filter,
  );
  const dependents = collectYarnDependents({
    packages,
    workspaces,
    onlyPackageNames: Object.keys(duplicatesPackagesMap),
  });

  displayMany({
    title: "duplicates",
    duplicatesPackagesMap,
    dependents,
    totalDependencies: Object.keys(packagesMap).length,
    identifiedFixesMap: buildIdentifiedFixesMap(
      duplicatesPackagesMap,
      dependents,
    ),
    // as in `whyDuplicate`: a family is shown whole as soon as it holds a
    // selected member, because that is what explains the duplicate
    clusterFixes: identifyClusterFixes(
      packagesMap,
      packages,
      workspaces,
    ).filter((fix) => fix.members.some(filter.selects)),
    details,
  });
}

// `--dry-run` and `--check` print the same plan and write nothing; only the exit
// code differs, so `--check` can gate CI while `--dry-run` stays informational.
export type DedupeMode = "apply" | "check" | "dry-run";

export interface FixDuplicatesOptions {
  mode?: DedupeMode;
  // the cluster pass edits package.json and runs `yarn install`; the pure-lock
  // pass that follows only rewrites the lockfile
  clusters?: boolean;
  // restricts which packages may be touched, for deduplicating a large lockfile
  // a family at a time
  filter?: PackageFilterOptions;
}

interface PlannedLockRewrite {
  entries: ReturnType<typeof applyIdentifiedFixesToYarnLock>["entries"];
  result: ReturnType<typeof applyIdentifiedFixesToYarnLock>["result"];
  // every version the rewritten copy resolves to, for the summary of the run
  versions: VersionsSnapshot;
  // the lockfile rewrite is the one thing the cluster pass does not know about,
  // so it is reported as the residual on top of the cluster plan
  residuals: string | undefined;
}

/**
 * Reads yarn.lock as it stands on disk and applies the pure-lock fixes to the
 * parsed copy. In memory only: nothing reaches disk until `writeYarnLockFile`,
 * so this doubles as the dry-run probe.
 */
const planLockRewrite = (
  projectDir: string,
  filterOptions: PackageFilterOptions | undefined,
): PlannedLockRewrite => {
  const filter = createPackageFilter(filterOptions);
  const { entries, packages, packagesMap, workspaces } =
    readProject(projectDir);

  const duplicatesPackagesMap = selectPackages(
    filterDuplicatesYarnPackagesMap(packagesMap),
    filter,
  );

  const dependents = collectYarnDependents({
    packages,
    workspaces,
    onlyPackageNames: Object.keys(duplicatesPackagesMap),
  });

  const rewrite = applyIdentifiedFixesToYarnLock(
    entries,
    buildIdentifiedFixesMap(duplicatesPackagesMap, dependents),
  );

  return {
    ...rewrite,
    // read back from the rewritten copy, so the summary reports what the run
    // produced rather than what it aimed for
    versions: versionsSnapshotOf(parseYarnLockPackages(rewrite.entries)),
    residuals: rewrite.result.changed
      ? `yarn.lock would be rewritten for ${rewrite.result.changedKeys.length} entrie(s): ${rewrite.result.changedKeys.join(", ")}`
      : undefined,
  };
};

// Cluster fixes go first: they are the only pass that can reach a version the
// lockfile does not carry, and the pure-lock pass then collapses the leaves
// yarn did not merge on its own.
export function fixDuplicates({
  mode = "apply",
  clusters = true,
  filter,
}: FixDuplicatesOptions = {}): void {
  const projectDir = resolveYarnProjectDir();
  if (projectDir === null) return;
  const dryRun = mode !== "apply";

  // Read before the cluster pass touches anything: `yarn install` rewrites the
  // lockfile, and the summary compares the whole run against this.
  const before = readVersionsSnapshot(lockPathOf(projectDir));

  // Only a dry run needs the residuals up front, to name them in the plan the
  // cluster pass prints. An apply plans the rewrite *after* the cluster pass,
  // against the lockfile `yarn install` left behind.
  const probe = dryRun ? planLockRewrite(projectDir, filter) : null;

  const clusterOutcome = clusters
    ? applyClusterFixes({
        projectDir,
        dryRun,
        filter,
        packageManagerResiduals: probe?.residuals,
      })
    : null;

  if (dryRun) {
    // the cluster pass renders the plan; without it there is nothing else to say
    if (!clusters) {
      renderApplyPlan({
        fileChanges: [],
        packageManagerResiduals: probe?.residuals,
        dedupeCommand: "yarn-berry-deduplicate",
      });
    }
    if (mode === "check") {
      process.exitCode =
        (clusterOutcome?.plannedChangeCount ?? 0) > 0 ||
        (probe?.result.changed ?? false)
          ? 1
          : 0;
    }
    return;
  }

  // The cluster pass runs `yarn install`, which rewrites yarn.lock on disk — so
  // the pure-lock pass has to plan against the file as it stands now. Planning
  // it earlier and writing that copy back would clobber the cluster result.
  const { entries, result, versions } = planLockRewrite(projectDir, filter);

  if (result.changed) {
    writeYarnLockFile(entries, lockPathOf(projectDir));
  }

  // Both passes at once: the cluster pass already rewrote the lockfile through
  // `yarn install`, and this copy carries the merges made on top of it.
  const deduped = diffVersionsSnapshots(before, versions);
  renderDedupeSummary({
    deduped,
    remainingDuplicates: countDuplicatedPackages(versions),
    whyCommand: "yarn-berry-why-duplicate",
  });

  if (result.changed) {
    console.log("yarn.lock updated");
    console.log("Please run `yarn install` to apply the changes");
  } else if (deduped.length === 0) {
    console.log("Nothing safe to dedupe identified");
  }
}
