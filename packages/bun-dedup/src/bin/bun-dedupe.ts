#!/usr/bin/env bun

import { fixDuplicates } from "../index.ts";
import type { DedupeMode } from "../index.ts";

const args = process.argv.slice(2);

// `--check` wins over `--dry-run`: both write nothing, and the caller that asked
// for a gate gets one.
const mode = ((): DedupeMode => {
  if (args.includes("--check")) return "check";
  if (args.includes("--dry-run") || args.includes("-n")) return "dry-run";
  return "apply";
})();

fixDuplicates({
  mode,
  clusters: !args.includes("--no-clusters"),
});
