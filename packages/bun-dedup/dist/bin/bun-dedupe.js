#!/usr/bin/env bun
import { fixDuplicates } from "../index.js";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-n");
fixDuplicates(dryRun);
//# sourceMappingURL=bun-dedupe.js.map