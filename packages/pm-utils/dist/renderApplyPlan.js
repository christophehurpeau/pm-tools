import { createColorize, shouldColorize } from "./reportColors.js";
import { plural } from "./reportText.js";
/**
 * The plan a dedupe run would apply, shared by `--check` and `--dry-run`. The
 * returned `changeCount` is what `--check` gates its exit code on.
 */
export const renderApplyPlan = ({ fileChanges, skipped = [], packageManagerResiduals, dedupeCommand, color: colorEnabled = shouldColorize(), log = console.log, }) => {
    const color = createColorize(colorEnabled);
    const changeCount = fileChanges.reduce((total, file) => total + file.changes.length, 0);
    if (changeCount === 0 && packageManagerResiduals === undefined) {
        for (const entry of skipped) {
            log(`  - ${color("red", entry)}`);
        }
        log("Nothing to dedupe.");
        return { changeCount };
    }
    if (changeCount > 0) {
        log(color("dim", "Would apply:"));
        for (const file of fileChanges) {
            if (file.changes.length === 0)
                continue;
            const suffix = file.transient === undefined
                ? ""
                : color("dim", ` (transient, ${file.transient})`);
            log();
            log(`${color("bold", file.path)}${suffix}:`);
            for (const change of file.changes) {
                log(`  - ${change}`);
            }
        }
    }
    if (skipped.length > 0) {
        log();
        log(color("dim", "Skipped:"));
        for (const entry of skipped) {
            log(`  - ${color("red", entry)}`);
        }
    }
    if (packageManagerResiduals !== undefined) {
        log();
        log(packageManagerResiduals);
    }
    const touchedFiles = fileChanges.filter((file) => file.changes.length > 0);
    const counts = changeCount === 0
        ? ""
        : `${plural(changeCount, "change", "changes")} in ${plural(touchedFiles.length, "file", "files")}. `;
    log();
    log(`${counts}Run ${color("cyan", `\`${dedupeCommand}\``)} to apply.`);
    return { changeCount };
};
//# sourceMappingURL=renderApplyPlan.js.map