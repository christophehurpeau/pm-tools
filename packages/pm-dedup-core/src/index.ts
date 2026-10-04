export {
  PackageDescriptorNameUtils,
  PackageDependencyDescriptorUtils,
  isNpmProtocol,
  isSemverComparable,
} from "./packageDependenciesUtils.ts";
export type {
  PackageDescriptorName,
  PackageDependencyDescriptor,
} from "./packageDependenciesUtils.ts";
export { buildLockstepClusters } from "./buildLockstepClusters.ts";
export type {
  LockstepGraph,
  LockstepResolution,
} from "./buildLockstepClusters.ts";
export { identifyLockstepClusterFixes } from "./identifyLockstepClusterFixes.ts";
export type {
  ClusterDependent,
  ClusterDependentsMap,
  ClusterExcludedMember,
  ClusterExternalConstraint,
  ClusterFix,
  ClusterMember,
  ClusterMemberVersions,
  ClusterMembersMap,
  ClusterReuseFix,
  ClusterWorkspaceChange,
  ClusterWorkspaceRef,
} from "./identifyLockstepClusterFixes.ts";
export { identifyResolutionFixes } from "./identifyResolutionFixes.ts";
export type {
  NpmResolutionPackage,
  ResolutionDependent,
  ResolutionDependentsMap,
  ResolutionEntry,
  ResolutionFix,
  ResolutionPackage,
} from "./identifyResolutionFixes.ts";
export { buildIdentifiedFixesMap } from "./buildIdentifiedFixesMap.ts";
export type { ResolutionsMap } from "./buildIdentifiedFixesMap.ts";
export {
  createPackageFilter,
  describeSkippedClusterFix,
  selectClusterFixes,
  selectPackages,
} from "./createPackageFilter.ts";
export type {
  PackageFilter,
  PackageFilterOptions,
  SelectedClusterFixes,
  SkippedClusterFix,
} from "./createPackageFilter.ts";
export {
  packageFilterParseArgsOptions,
  packageFilterUsage,
  toPackageFilterOptions,
  toWhyDuplicateRequest,
  whyDuplicateParseArgsOptions,
  whyDuplicateUsage,
} from "./packageFilterArgs.ts";
export type {
  PackageFilterArgValues,
  WhyDuplicateArgValues,
  WhyDuplicateRequest,
} from "./packageFilterArgs.ts";
export { parseBinArgs } from "./parseBinArgs.ts";
export { findProjectRoot, resolveProjectDir } from "./findProjectRoot.ts";
export type { ProjectRootOptions } from "./findProjectRoot.ts";
export { createCandidateVersionComparator } from "./compareCandidateVersions.ts";
export type { CandidateVersionComparatorOptions } from "./compareCandidateVersions.ts";
export { clusterLabel } from "./clusterLabel.ts";
export { createColorize, shouldColorize } from "./reportColors.ts";
export type { Colorize, PaletteStyle, ReportStyle } from "./reportColors.ts";
export { stylePackageName, stylePackageReference } from "./packageStyles.ts";
export { renderDuplicatesReport } from "./renderDuplicatesReport.ts";
export type {
  DuplicateDedupeView,
  DuplicateDependentView,
  DuplicatePackageView,
  DuplicateResolutionView,
  DuplicatesReportOptions,
  DuplicatesReportTitle,
} from "./renderDuplicatesReport.ts";
export { selectExplainedPackages } from "./selectExplainedPackages.ts";
export type {
  ExplainedPackagesSelection,
  SelectExplainedPackagesOptions,
} from "./selectExplainedPackages.ts";
export { renderApplyPlan } from "./renderApplyPlan.ts";
export type {
  ApplyPlanFileChange,
  ApplyPlanOptions,
  ApplyPlanSummary,
} from "./renderApplyPlan.ts";
export { renderDedupeSummary } from "./renderDedupeSummary.ts";
export type { DedupeSummaryOptions } from "./renderDedupeSummary.ts";
export {
  buildVersionsSnapshot,
  countDuplicatedPackages,
  diffVersionsSnapshots,
} from "./versionsSnapshot.ts";
export type {
  DedupedPackage,
  SnapshotPackage,
  VersionsSnapshot,
} from "./versionsSnapshot.ts";
export { captureFiles, restoreFiles } from "./fileSnapshot.ts";
export type { FileSnapshot } from "./fileSnapshot.ts";
export { applyWorkspaceRangeEdit, nextSelector } from "./workspaceManifest.ts";
export type { WorkspaceRangeEdit } from "./workspaceManifest.ts";
export { planClusterApply } from "./planClusterApply.ts";
export type {
  ClusterApplyPlan,
  PlannedManifestEdit,
  PlannedOverride,
} from "./planClusterApply.ts";
export { diffDuplicates } from "./duplicateSnapshot.ts";
export type { DuplicateDiff, DuplicateSnapshot } from "./duplicateSnapshot.ts";
export { partitionUnconditionalOverrides } from "./unconditionalOverrides.ts";
export type {
  PartitionedOverrides,
  RejectedOverride,
} from "./unconditionalOverrides.ts";
