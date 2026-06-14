#!/usr/bin/env bun

import { dedupe } from "../dedupe.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-n");

dedupe(dryRun);
