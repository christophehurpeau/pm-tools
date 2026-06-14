import { spawnSync } from "node:child_process";
// pnpm-lock.yaml does not store transitive declared ranges, so we cannot
// safely recompute merges from the lockfile alone. Delegate to `pnpm dedupe`,
// which re-resolves against the real registry/manifest ranges.
export function dedupe(dryRun = false) {
    const args = dryRun ? ["dedupe", "--check"] : ["dedupe"];
    const result = spawnSync("pnpm", args, { stdio: "inherit" });
    if (result.error) {
        throw result.error;
    }
    if (dryRun && result.status !== 0) {
        console.log("Duplicates can be deduped. Run `pnpm-dedupe` to apply.");
    }
    if (result.status !== null) {
        process.exitCode = result.status;
    }
}
//# sourceMappingURL=dedupe.js.map