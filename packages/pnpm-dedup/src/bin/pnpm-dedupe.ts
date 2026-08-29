#!/usr/bin/env node

import {
  packageFilterParseArgsOptions,
  packageFilterUsage,
  parseBinArgs,
  toPackageFilterOptions,
} from "pm-utils";
import { dedupe } from "../dedupe.ts";
import type { DedupeMode } from "../dedupe.ts";

const usage = `Usage: pnpm-dedupe [options]

  --check                      print the plan, change nothing, exit 1 if anything would change
  -n, --dry-run                print the plan, change nothing
  --no-convergence-overrides   write plain overrides instead of convergence ones

${packageFilterUsage}`;

const parsed = parseBinArgs(usage, {
  args: process.argv.slice(2),
  options: {
    check: { type: "boolean" },
    "dry-run": { type: "boolean", short: "n" },
    "no-convergence-overrides": { type: "boolean" },
    ...packageFilterParseArgsOptions,
  },
});

if (parsed !== null) {
  const { values } = parsed;

  const mode = ((): DedupeMode => {
    if (values.check) return "check";
    if (values["dry-run"]) return "dry-run";
    return "apply";
  })();

  dedupe({
    mode,
    convergenceOverrides: !values["no-convergence-overrides"],
    filter: toPackageFilterOptions(values),
  });
}
