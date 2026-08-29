import { listText, plural } from "./reportText.js";
const singleVersionNotice = (names) => {
    const shown = listText({
        items: names,
        more: (rest) => `, +${rest} more`,
    });
    return names.length === 1
        ? `${shown} is not duplicated. Showing its dependents:`
        : `None of the ${plural(names.length, "match", "matches")} is duplicated (${shown}). Showing their dependents:`;
};
/**
 * The packages a `why-duplicate` run reports on. Naming a package is asking why
 * it is duplicated, and the honest answer to "it is not" is its dependents, not
 * an empty report: a selection holding no duplicate is kept whole, and the
 * notice says why it is being shown.
 *
 * `--all` asks for that unconditionally, so it never needs the fallback.
 */
export const selectExplainedPackages = ({ packagesMap, filter, all, }) => {
    const selected = Object.entries(packagesMap).filter(([packageName]) => filter.selects(packageName));
    if (all) {
        return {
            packages: Object.fromEntries(selected),
            title: "matches",
            notice: undefined,
        };
    }
    const duplicated = selected.filter(([, resolutions]) => resolutions.length > 1);
    if (duplicated.length > 0 || selected.length === 0) {
        return {
            packages: Object.fromEntries(duplicated),
            title: "duplicates",
            notice: undefined,
        };
    }
    return {
        packages: Object.fromEntries(selected),
        title: "matches",
        notice: singleVersionNotice(selected.map(([packageName]) => packageName)),
    };
};
//# sourceMappingURL=selectExplainedPackages.js.map