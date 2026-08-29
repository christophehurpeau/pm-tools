import semver from "semver";
import { clusterLabel } from "./clusterLabel.js";
import { stylePackageName, stylePackageReference } from "./packageStyles.js";
import { createColorize, shouldColorize } from "./reportColors.js";
import { columnWidth, listText, padTo, plural } from "./reportText.js";
const clusterExplanation = [
    "A lockstep cluster is a family of packages published together: each member",
    "pins its siblings at its own version, so a duplicate inside the family only",
    "disappears when the whole family moves to a single version.",
];
const unattributedLabel = "(resolved version unknown)";
const directionLabel = (direction) => {
    if (direction === "down")
        return " (downgrade)";
    if (direction === "up")
        return " (upgrade)";
    return "";
};
const compareVersionsDescending = (versionA, versionB) => semver.valid(versionA) !== null && semver.valid(versionB) !== null
    ? semver.rcompare(versionA, versionB)
    : versionA.localeCompare(versionB);
const toGroups = (view) => {
    const byLabel = new Map();
    for (const { resolution, version, installations } of view.resolutions) {
        const label = version ?? resolution;
        const group = byLabel.get(label);
        // several resolutions of one version — a peer context, an extra install
        // path — are one version to the reader, and their locations are the detail
        if (group) {
            group.installations.push(...installations);
            continue;
        }
        byLabel.set(label, {
            label,
            version,
            installations: [...installations],
            dependents: [],
            mergesInto: undefined,
            direction: undefined,
        });
    }
    return [...byLabel.values()].toSorted((groupA, groupB) => {
        if (groupA.version === undefined || groupB.version === undefined) {
            return groupA.version === groupB.version
                ? 0
                : Number(groupA.version === undefined) -
                    Number(groupB.version === undefined);
        }
        return compareVersionsDescending(groupA.version, groupB.version);
    });
};
// A resolution with no npm version — a `patch:` install, a tarball, a git url —
// is its own group, labelled by the resolution string. A requester that declared
// it is filed there by that same string, there being no version to file it under.
const byResolutionOf = (view, groups) => {
    const byLabel = new Map(groups.map((group) => [group.label, group]));
    return new Map(view.resolutions.flatMap(({ resolution, version }) => {
        const group = byLabel.get(version ?? resolution);
        return group ? [[resolution, group]] : [];
    }));
};
const byVersionOf = (groups) => new Map(groups
    .filter((group) => group.version !== undefined)
    .map((group) => [group.version, group]));
const applyMerges = (byVersion, view, cluster) => {
    for (const { from, to, direction } of view.dedupe) {
        for (const version of from) {
            const group = byVersion.get(version);
            if (!group)
                continue;
            group.mergesInto = to;
            group.direction = direction;
        }
    }
    // A family only converges as a whole, so a member the cluster pass covers
    // collapses onto the family's target even though nothing about the package
    // alone says so.
    if (view.dedupe.length > 0 || cluster === undefined)
        return;
    if (!byVersion.has(cluster.target))
        return;
    for (const group of byVersion.values()) {
        if (group.version === cluster.target)
            continue;
        group.mergesInto = cluster.target;
        group.direction = cluster.direction;
    }
};
const analysePackage = (view, cluster) => {
    const groups = toGroups(view);
    const byVersion = byVersionOf(groups);
    const byResolution = byResolutionOf(view, groups);
    // A package the lockfile resolves once leaves nothing to attribute: whatever
    // got a copy got that one. Peer ranges arrive with no resolved version of
    // their own — the version a peer requester was handed is its parent's
    // business — and filing twenty of them under "(resolved version unknown)"
    // next to a single resolution reads as missing data instead of the one thing
    // that is certain. A range the sole version does not satisfy still belongs
    // there: an unmet peer is a warning the package manager already gave, not a
    // second copy. Only a lone versioned group qualifies — a second resolution,
    // even an unversioned git url or tarball, makes it a guess again.
    const soleGroup = groups.length === 1 && groups[0].version !== undefined
        ? groups[0]
        : undefined;
    const groupOf = (dependent) => {
        if (dependent.resolvedResolution !== undefined) {
            return byResolution.get(dependent.resolvedResolution);
        }
        if (dependent.resolvedVersion !== undefined) {
            return byVersion.get(dependent.resolvedVersion) ?? soleGroup;
        }
        return soleGroup;
    };
    const unattributed = [];
    for (const dependent of view.dependents) {
        const group = groupOf(dependent);
        if (group)
            group.dependents.push(dependent);
        else
            unattributed.push(dependent);
    }
    applyMerges(byVersion, view, cluster);
    const after = [
        ...new Set(groups.map((group) => group.mergesInto ?? group.label)),
    ].toSorted(compareVersionsDescending);
    return { groups, unattributed, after };
};
const merges = ({ groups }) => groups.some((group) => group.mergesInto !== undefined);
/**
 * What the package is left with once the merges are applied. `deduped to 3
 * versions` always means three remain — never three merged away, which is the
 * one reading a dedupe report cannot afford to be ambiguous about.
 */
const verdictText = (color, analysis) => {
    if (!merges(analysis))
        return "";
    const { groups, after } = analysis;
    const direction = groups.find((group) => group.mergesInto !== undefined)?.direction;
    if (after.length === 1) {
        return `, can be deduped to ${color("green", after[0])}${directionLabel(direction)}`;
    }
    return `, can be deduped to ${color("green", plural(after.length, "version", "versions"))}`;
};
const renderSummaryLine = (view, analysis, nameWidth, color, log) => {
    const { groups } = analysis;
    const census = listText({
        items: groups.map((group) => group.label),
        render: (label) => color("yellow", label),
        more: (rest) => color("dim", `, +${rest} more`),
    });
    const installations = groups.reduce((total, group) => total + group.installations.length, 0);
    // with a single version the census says nothing about why the package is
    // listed; the install paths are what make it a duplicate
    const paths = groups.length === 1 && installations > 1
        ? color("dim", ` installed at ${plural(installations, "path", "paths")}`)
        : "";
    log(`- ${stylePackageName(color, view.packageName)}${padTo(nameWidth, view.packageName)}  resolved to ${plural(groups.length, "version", "versions")} (${census})${paths}${verdictText(color, analysis)}`);
};
const dependentLine = (dependent, requesterWidth, color) => `    - ${stylePackageReference(color, dependent.requester)}${padTo(requesterWidth, dependent.requester)}  requires ${color("yellow", `"${dependent.range}"`)}${dependent.peer ? color("dim", " (peer)") : ""}`;
const renderGroup = (group, requesterWidth, color, log) => {
    const merge = group.mergesInto === undefined
        ? ""
        : `  ${color("dim", "can be deduped to")} ${color("green", group.mergesInto)}${directionLabel(group.direction)}`;
    log(`  ${stylePackageReference(color, group.label)}${merge}`);
    for (const dependent of group.dependents) {
        log(dependentLine(dependent, requesterWidth, color));
    }
    if (group.dependents.length === 0) {
        log(`    ${color("dim", "(no semver range recorded for it)")}`);
    }
    // install paths are long, and the reader is here for the ranges: a handful
    // locates the copy, the rest is counted
    if (group.installations.length > 1) {
        log(`    ${color("dim", "installed at:")} ${listText({
            items: group.installations,
            render: (location) => stylePackageReference(color, location),
            limit: 3,
            more: (rest) => color("dim", `, +${rest} more`),
        })}`);
    }
};
const renderPackageDetails = (view, analysis, clusterIndex, color, log) => {
    const { groups, unattributed } = analysis;
    const cluster = clusterIndex === undefined
        ? ""
        : color("dim", ` (cluster ${clusterIndex})`);
    log();
    log(`${stylePackageName(color, view.packageName, ["bold", "packageName"])} — ${plural(groups.length, "version", "versions")}${verdictText(color, analysis)}${cluster}`);
    const requesterWidth = columnWidth(view.dependents.map((dependent) => dependent.requester));
    for (const group of groups) {
        renderGroup(group, requesterWidth, color, log);
    }
    if (unattributed.length > 0) {
        log(`  ${color("dim", unattributedLabel)}`);
        for (const dependent of unattributed) {
            log(dependentLine(dependent, requesterWidth, color));
        }
    }
};
// a workspace importer has no npm name; it is the one requester named by role
const constraintName = (requesterName) => requesterName ?? "workspace";
const constraintText = (color, requesterName) => requesterName === undefined
    ? color("dim", "workspace")
    : stylePackageName(color, requesterName);
const nameList = (color, names) => names.map((name) => stylePackageName(color, name)).join(", ");
// highest version first, whatever could not be attributed to one last
const compareGroupLabels = (labelA, labelB) => {
    if (labelA === labelB)
        return 0;
    if (labelA === unattributedLabel)
        return 1;
    if (labelB === unattributedLabel)
        return -1;
    return compareVersionsDescending(labelA, labelB);
};
/**
 * The third-party ranges bearing on the family, filed under the version each of
 * them resolved to — the same shape a package's own resolutions take, because it
 * answers the same question: which requester keeps which copy alive.
 */
const renderExternalResolutions = (constraints, color, log) => {
    const byVersion = new Map();
    for (const constraint of constraints) {
        const label = constraint.resolvedVersion ?? unattributedLabel;
        const group = byVersion.get(label);
        if (group)
            group.push(constraint);
        else
            byVersion.set(label, [constraint]);
    }
    const labels = [...byVersion.keys()].toSorted(compareGroupLabels);
    const width = columnWidth(constraints.map((constraint) => constraintName(constraint.requesterName)));
    log(`  ${color("dim", "Resolutions (external):")}`);
    for (const label of labels) {
        log(`    ${label === unattributedLabel ? color("dim", label) : stylePackageReference(color, label)}`);
        for (const constraint of byVersion.get(label)) {
            log(`      - ${constraintText(color, constraint.requesterName)}${padTo(width, constraintName(constraint.requesterName))}  requires ${stylePackageName(color, constraint.packageName)} ${color("yellow", `"${constraint.range}"`)}`);
        }
    }
};
const renderCluster = (fix, index, color, log) => {
    const fixable = fix.applicable ? fix.convergentMembers.length : 0;
    const counts = [
        plural(fix.members.length, "package", "packages"),
        `${fix.duplicatedMembers.length} duplicated`,
        `${fixable} fixable`,
    ].join(", ");
    log();
    log(`cluster ${index} — ${color(["bold", "cyan"], clusterLabel(fix.members))} [${counts}]:`);
    log(`  ${color("dim", "Members:")}`);
    const width = columnWidth(fix.members);
    for (const member of fix.members) {
        const installed = fix.memberVersions[member];
        const versions = color("yellow", installed?.versions.join(", ") ?? "");
        const nonNpm = installed && installed.nonNpmCount > 0
            ? color("dim", ` (+${installed.nonNpmCount} non-npm)`)
            : "";
        log(`    - ${stylePackageName(color, member)}${padTo(width, member)}  ${versions}${nonNpm}`);
    }
    if (fix.applicable && fix.target !== null) {
        log(`  ${color("dim", "Dedupe:")} ${color("green", fix.target)}${directionLabel(fix.direction)}`);
        if (fix.driverMembers.length > 0) {
            const followers = fix.convergentMembers.length - fix.driverMembers.length;
            const follow = followers > 0
                ? color("dim", ` (${plural(followers, "member follows", "members follow")})`)
                : "";
            log(`    ${color("dim", "Driven by:")} ${nameList(color, fix.driverMembers)}${follow}`);
        }
        // nothing pins these, so the package manager picks their version: the
        // fixable count above is not a guarantee for them
        if (fix.floatingMembers.length > 0) {
            log(`    ${color("dim", "Resolver picks:")} ${nameList(color, fix.floatingMembers)}`);
        }
    }
    if (fix.excludedMembers.length > 0) {
        log(`  ${color("dim", "Remaining duplicates:")}`);
        for (const excluded of fix.excludedMembers) {
            const blockers = excluded.blockedBy
                .map((constraint) => `${constraintText(color, constraint.requesterName)} requires ${color("yellow", `"${constraint.range}"`)}`)
                .join(", ");
            log(`    - ${stylePackageName(color, excluded.packageName, ["red"])}: ${blockers}`);
        }
    }
    if (fix.reuseFixes.length > 0) {
        log(`  ${color("dim", `Open ranges not reusing the pinned ${fix.anchor ?? ""}:`)}`);
        for (const reuse of fix.reuseFixes) {
            log(`    - ${constraintText(color, reuse.requesterName)} requires ${stylePackageName(color, reuse.packageName)} ${color("yellow", `"${reuse.range}"`)}, resolved ${color("yellow", reuse.from)} -> would pin ${color("green", reuse.to)}`);
        }
    }
    if (fix.externalConstraints.length > 0) {
        renderExternalResolutions(fix.externalConstraints, color, log);
    }
};
// What a family converges its members onto, for the packages whose own
// resolutions say nothing about it.
const clusterConvergences = (clusterFixes) => {
    const convergences = new Map();
    for (const fix of clusterFixes) {
        if (!fix.applicable || fix.target === null)
            continue;
        for (const member of fix.convergentMembers) {
            if (convergences.has(member))
                continue;
            convergences.set(member, {
                target: fix.target,
                direction: fix.direction,
            });
        }
    }
    return convergences;
};
export const renderDuplicatesReport = ({ title, packages, notice, totalDependencies, clusterFixes = [], dedupeCommand, whyCommand, details = false, color: colorEnabled = shouldColorize(), log = console.log, }) => {
    const color = createColorize(colorEnabled);
    const titleSingular = title === "duplicates" ? "duplicate" : "match";
    if (notice !== undefined) {
        log(notice);
    }
    else if (packages.length === 0) {
        log("No duplicates found");
    }
    else {
        log(`Found ${plural(packages.length, titleSingular, title)}:`);
    }
    // a cluster of one carries no family to explain: it is rendered as the
    // package's own fix, in its own block
    const clusters = clusterFixes.filter((fix) => fix.duplicatedMembers.length > 0 && fix.members.length > 1);
    const clusterIndexes = new Map();
    clusters.forEach((fix, index) => {
        for (const member of fix.members) {
            if (!clusterIndexes.has(member))
                clusterIndexes.set(member, index + 1);
        }
    });
    const convergences = clusterConvergences(clusterFixes);
    const analyses = packages.map((view) => ({
        view,
        analysis: analysePackage(view, convergences.get(view.packageName)),
    }));
    if (details) {
        for (const { view, analysis } of analyses) {
            renderPackageDetails(view, analysis, clusterIndexes.get(view.packageName), color, log);
        }
        if (clusters.length > 0) {
            log();
            log(color("dim", "Lockstep clusters:"));
            for (const line of clusterExplanation) {
                log(`  ${color("dim", line)}`);
            }
            clusters.forEach((fix, index) => {
                renderCluster(fix, index + 1, color, log);
            });
        }
    }
    else if (analyses.length > 0) {
        const nameWidth = columnWidth(packages.map((view) => view.packageName));
        log();
        for (const { view, analysis } of analyses) {
            renderSummaryLine(view, analysis, nameWidth, color, log);
        }
    }
    const dedupable = analyses.filter(({ analysis }) => merges(analysis)).length;
    log();
    if (dedupable === 0) {
        log(`Found ${plural(totalDependencies, "dependency", "dependencies")}, ${plural(packages.length, titleSingular, title)}, 0 dedupable.`);
    }
    else {
        // Merging a package collapses its own dependency edges too, so a run can
        // remove copies no per-package fix predicted: the count is a floor.
        log(`Found ${plural(totalDependencies, "dependency", "dependencies")}, ${plural(packages.length, titleSingular, title)}, at least ${dedupable} dedupable (deduping may remove more). Run ${color("cyan", `\`${dedupeCommand}\``)} to apply.`);
    }
    if (!details && whyCommand !== undefined && packages.length > 0) {
        log(`Run ${color("cyan", `\`${whyCommand} --details\``)} to see every dependent.`);
    }
};
//# sourceMappingURL=renderDuplicatesReport.js.map