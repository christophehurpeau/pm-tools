import { applyClusterFixes } from "./applyClusterFixes.js";
import { runPnpm } from "./helpers/runPnpm.js";
const residualsMessage = "`pnpm dedupe` would also change the lockfile.";
/**
 * `pnpm dedupe` only merges what it can resolve to a single version on its own:
 * it never widens a workspace range, and it never repoints an edge that resolved
 * past a version the family already carries. Cluster fixes cover exactly that
 * gap, so they run first and `pnpm dedupe` finishes the residuals.
 */
export function dedupe({ mode = "apply", convergenceOverrides = true, } = {}) {
    const dryRun = mode !== "apply";
    const projectDir = process.cwd();
    // Read-only, so it can run before the cluster pass. It has to, for a dry run:
    // the plan report names the residuals, and only this knows about them.
    const probe = dryRun ? runPnpm(["dedupe", "--check"]) : null;
    const outcome = applyClusterFixes({
        projectDir,
        dryRun,
        convergenceOverrides,
        packageManagerResiduals: probe !== null && probe.status !== 0 ? residualsMessage : undefined,
    });
    if (outcome.status === "applied" || outcome.status === "kept-overrides") {
        console.log(`Cluster fixes: ${outcome.before.size} duplicate resolutions -> ${outcome.after.size}`);
    }
    if (outcome.status === "kept-overrides") {
        console.log(`  ${outcome.stickyOverrides.length} override(s) left in pnpm-workspace.yaml — see the comment above them`);
    }
    if (mode === "check") {
        process.exitCode =
            outcome.plannedChangeCount > 0 || probe?.status !== 0 ? 1 : 0;
        return;
    }
    if (mode === "dry-run")
        return;
    const result = runPnpm(["dedupe"]);
    if (result.status !== null) {
        process.exitCode = result.status;
    }
}
//# sourceMappingURL=dedupe.js.map