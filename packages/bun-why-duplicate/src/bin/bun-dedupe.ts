#!/usr/bin/env bun

import { fixDuplicates } from "../index.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-n");

fixDuplicates(dryRun);
