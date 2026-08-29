#!/usr/bin/env bun
import { parseBinArgs, toWhyDuplicateRequest, whyDuplicateParseArgsOptions, whyDuplicateUsage, } from "pm-utils";
import { listDuplicates, whyDuplicate } from "../index.js";
const usage = `Usage: bun-why-duplicate [package] [options]

  [package]                    a name or a glob; the short form of --packages
${whyDuplicateUsage}`;
const parsed = parseBinArgs(usage, {
    args: process.argv.slice(2),
    options: whyDuplicateParseArgsOptions,
    allowPositionals: true,
});
if (parsed !== null) {
    const { values, positionals } = parsed;
    const { filter, explains, all, details } = toWhyDuplicateRequest(values, positionals);
    if (explains) {
        whyDuplicate({ filter, all, details });
    }
    else {
        listDuplicates({ filter, details });
    }
}
//# sourceMappingURL=bun-why-duplicate.js.map