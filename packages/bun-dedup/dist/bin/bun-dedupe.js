#!/usr/bin/env bun
import { packageFilterParseArgsOptions, packageFilterUsage, parseBinArgs, toPackageFilterOptions, } from "pm-utils";
import { fixDuplicates } from "../index.js";
const usage = `Usage: bun-dedupe [options]

  --check                      print the plan, change nothing, exit 1 if anything would change
  -n, --dry-run                print the plan, change nothing
  --no-clusters                skip the cluster pass, rewrite the lockfile only

${packageFilterUsage}`;
const parsed = parseBinArgs(usage, {
    args: process.argv.slice(2),
    options: {
        check: { type: "boolean" },
        "dry-run": { type: "boolean", short: "n" },
        "no-clusters": { type: "boolean" },
        ...packageFilterParseArgsOptions,
    },
});
if (parsed !== null) {
    const { values } = parsed;
    // `--check` wins over `--dry-run`: both write nothing, and the caller that
    // asked for a gate gets one.
    const mode = (() => {
        if (values.check)
            return "check";
        if (values["dry-run"])
            return "dry-run";
        return "apply";
    })();
    fixDuplicates({
        mode,
        clusters: !values["no-clusters"],
        filter: toPackageFilterOptions(values),
    });
}
//# sourceMappingURL=bun-dedupe.js.map