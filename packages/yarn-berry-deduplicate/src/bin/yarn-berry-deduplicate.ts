#!/usr/bin/env node

import {
  packageFilterParseArgsOptions,
  packageFilterUsage,
  parseBinArgs,
  toPackageFilterOptions,
} from "pm-dedup-core";
import { fixDuplicates } from "../index.ts";
import type { DedupeMode } from "../index.ts";

const usage = `Usage: yarn-berry-deduplicate [options]

  --check                      print the plan, change nothing, exit 1 if anything would change
  -n, --dry-run                print the plan, change nothing
  --dedupe-by-direct-major-bump
                               let a cluster fix bump a direct dependency to its next major
  --no-clusters                skip the cluster pass, rewrite the lockfile only

${packageFilterUsage}`;

const parsed = parseBinArgs(usage, {
  args: process.argv.slice(2),
  options: {
    check: { type: "boolean" },
    "dry-run": { type: "boolean", short: "n" },
    "dedupe-by-direct-major-bump": { type: "boolean" },
    "no-clusters": { type: "boolean" },
    ...packageFilterParseArgsOptions,
  },
});

if (parsed !== null) {
  const { values } = parsed;

  // `--check` wins over `--dry-run`: both write nothing, and the caller that
  // asked for a gate gets one.
  const mode = ((): DedupeMode => {
    if (values.check) return "check";
    if (values["dry-run"]) return "dry-run";
    return "apply";
  })();

  fixDuplicates({
    mode,
    clusters: !values["no-clusters"],
    filter: toPackageFilterOptions(values),
    dedupeByDirectMajorBump: values["dedupe-by-direct-major-bump"],
  });
}
