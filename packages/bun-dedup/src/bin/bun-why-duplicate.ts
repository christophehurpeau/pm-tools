#!/usr/bin/env bun

import { listDuplicates, whyDuplicate } from "../index.ts";

const args = process.argv.slice(2);
const pkgName = args.find((arg) => !arg.startsWith("-"));

if (pkgName) {
  whyDuplicate(pkgName, args.includes("--all") || args.includes("-a"));
} else {
  listDuplicates();
}
