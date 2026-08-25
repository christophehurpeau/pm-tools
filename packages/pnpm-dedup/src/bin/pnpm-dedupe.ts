#!/usr/bin/env node

import { dedupe } from "../dedupe.ts";
import type { DedupeMode } from "../dedupe.ts";

const args = process.argv.slice(2);

// `--check` wins over `--dry-run`: both write nothing, and the caller that asked
// for a gate gets one.
const mode = ((): DedupeMode => {
  if (args.includes("--check")) return "check";
  if (args.includes("--dry-run") || args.includes("-n")) return "dry-run";
  return "apply";
})();

dedupe({
  mode,
  convergenceOverrides: !args.includes("--no-convergence-overrides"),
});
