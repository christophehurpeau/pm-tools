import { describe, expect, it } from "bun:test";
import { buildIdentifiedFixesMap, createPackageFilter, selectPackages, } from "pm-utils";
import { applyIdentifiedFixesToYarnLock } from "./applyIdentifiedFixesToYarnLock.js";
import { filterDuplicatesYarnPackagesMap } from "./buildYarnPackagesMap.js";
import { collectYarnDependents } from "./collectYarnDependents.js";
import { loadFixture, readFixtureLock } from "./fixtures.js";
import { packageEntries, parseYarnLock, stringifyYarnLock } from "./syml.js";
const dedupeFixture = (name, filterOptions) => {
    const { entries, packages, packagesMap, workspaces } = loadFixture(name);
    const duplicates = selectPackages(filterDuplicatesYarnPackagesMap(packagesMap), createPackageFilter(filterOptions));
    const dependents = collectYarnDependents({
        packages,
        workspaces,
        onlyPackageNames: Object.keys(duplicates),
    });
    const { entries: after, result } = applyIdentifiedFixesToYarnLock(entries, buildIdentifiedFixesMap(duplicates, dependents));
    return {
        before: readFixtureLock(name),
        after: stringifyYarnLock(after),
        changed: result.changed,
        changedKeys: result.changedKeys,
        entries: after,
    };
};
const descriptorsOf = (entries) => packageEntries(entries)
    .flatMap(([key]) => key.split(", "))
    .toSorted();
const entryForDescriptor = (entries, descriptor) => {
    const found = packageEntries(entries).find(([key]) => key.split(", ").includes(descriptor));
    if (!found)
        throw new Error(`no entry carries ${descriptor}`);
    return { key: found[0], resolution: found[1].resolution };
};
describe("applyIdentifiedFixesToYarnLock", () => {
    it("merges two resolutions onto the version that satisfies every dependent", () => {
        const { after, changed, changedKeys } = dedupeFixture("duplicated-printable-shell-command");
        expect(changed).toBe(true);
        expect(changedKeys).toEqual(["printable-shell-command@npm:^5.0.7"]);
        expect(after).toContain('"printable-shell-command@npm:^5.0.7, printable-shell-command@npm:^5.0.8":');
        expect(after).not.toContain('resolution: "printable-shell-command@npm:5.0.7"');
    });
    // a descriptor dropped here is a dependency yarn would stop resolving
    it("keeps every input descriptor", () => {
        for (const name of [
            "duplicated-printable-shell-command",
            "mergeable-alias",
            "workspaces",
            "exact-pin-forces-downgrade",
        ]) {
            const { entries } = dedupeFixture(name);
            const { packagesMap } = loadFixture(name);
            expect(descriptorsOf(entries)).toHaveLength(Object.values(packagesMap).flatMap((r) => r.flatMap((x) => x.installations)).length);
        }
    });
    // a yarn.lock key is the range a requester declared, and that is what yarn
    // matches against: the range stays and the entry under it changes
    it("moves a descriptor onto the target entry without rewriting it", () => {
        const { entries } = dedupeFixture("duplicated-printable-shell-command");
        expect(entryForDescriptor(entries, "printable-shell-command@npm:^5.0.7")
            .resolution).toBe("printable-shell-command@npm:5.0.8");
    });
    it("keeps an alias's own key when it moves", () => {
        const { entries, after } = dedupeFixture("mergeable-alias");
        expect(after).toContain('"printable-shell-command@npm:^5.0.8, psc@npm:printable-shell-command@^5.0.0":');
        expect(entryForDescriptor(entries, "psc@npm:printable-shell-command@^5.0.0")
            .resolution).toBe("printable-shell-command@npm:5.0.8");
    });
    it("leaves a clean lockfile byte-identical", () => {
        const { before, after, changed } = dedupeFixture("simple");
        expect(changed).toBe(false);
        expect(after).toBe(before);
    });
    it("does not merge ranges that do not overlap", () => {
        const { before, after, changed } = dedupeFixture("duplicated-babel-frame");
        expect(changed).toBe(false);
        expect(after).toBe(before);
    });
    it("leaves an alias whose range covers nothing else alone", () => {
        const { before, after, changed } = dedupeFixture("aliased-range-constrains-merge");
        expect(changed).toBe(false);
        expect(after).toBe(before);
    });
    it("leaves a pair a peer range forbids merging alone", () => {
        const { before, after, changed } = dedupeFixture("peer-range-constrains-merge");
        expect(changed).toBe(false);
        expect(after).toBe(before);
    });
    it("leaves workspace, patch and git resolutions untouched", () => {
        const { before, after, changed } = dedupeFixture("non-npm");
        expect(changed).toBe(false);
        expect(after).toBe(before);
    });
    it("merges onto a lower version when an exact pin is the only common one", () => {
        const { after, changed } = dedupeFixture("exact-pin-forces-downgrade");
        expect(changed).toBe(true);
        expect(after).toContain('"barcode-detector@npm:3.0.3, barcode-detector@npm:^3.0.0":');
        expect(after).not.toContain('resolution: "barcode-detector@npm:3.2.2"');
        // the entry the merged descriptors now share is the pinned one
        expect(after).toContain('resolution: "barcode-detector@npm:3.0.3"');
    });
    describe("package filters", () => {
        it("moves nothing outside the selected packages", () => {
            const { after, before, changed } = dedupeFixture("workspaces", {
                include: ["lodash"],
            });
            expect(changed).toBe(false);
            expect(after).toBe(before);
        });
        it("moves the selected package", () => {
            const { changed, changedKeys } = dedupeFixture("workspaces", {
                include: ["semver"],
            });
            expect(changed).toBe(true);
            expect(changedKeys).toEqual(["semver@npm:^7.6.0"]);
        });
        it("honours an exclusion", () => {
            const { changed } = dedupeFixture("workspaces", {
                exclude: ["semver"],
            });
            expect(changed).toBe(false);
        });
    });
    // group membership is by target version, which is not the same as which
    // instance installed it: the entry has to be found wherever it lives
    it("takes the entry from the instance sitting on the target version", () => {
        const entries = parseYarnLock(`__metadata:
  version: 8

"lib@npm:1.5.0":
  version: 1.5.0
  resolution: "lib@npm:1.5.0"
  checksum: 10c0/bbbb

"lib@npm:^1.0.0":
  version: 1.0.0
  resolution: "lib@npm:1.0.0"
  checksum: 10c0/aaaa
`);
        const fixes = new Map([
            [
                "lib",
                [
                    {
                        mergeableResolutions: ["lib@npm:1.0.0", "lib@npm:1.5.0"],
                        to: "lib@npm:1.5.0",
                    },
                ],
            ],
        ]);
        const { entries: after } = applyIdentifiedFixesToYarnLock(entries, fixes);
        expect(packageEntries(after)).toHaveLength(1);
        expect(entryForDescriptor(after, "lib@npm:^1.0.0")).toEqual({
            key: "lib@npm:1.5.0, lib@npm:^1.0.0",
            resolution: "lib@npm:1.5.0",
        });
    });
    // writing an entry that is not there would drop its descriptors silently
    it("throws rather than group under a resolution the lockfile does not carry", () => {
        const entries = parseYarnLock(`__metadata:
  version: 8

"lib@npm:^1.0.0":
  version: 1.0.0
  resolution: "lib@npm:1.0.0"
`);
        expect(() => applyIdentifiedFixesToYarnLock(entries, new Map([
            [
                "lib",
                [
                    {
                        mergeableResolutions: ["lib@npm:1.0.0", "lib@npm:9.9.9"],
                        to: "lib@npm:9.9.9",
                    },
                ],
            ],
        ]))).toThrow('No lockfile entry found for "lib@npm:9.9.9"');
    });
    // two fixes for one package can chain: stopping at the first hop would leave
    // a descriptor on an entry that itself moved away
    it("follows a chain of merges to the entry that survives", () => {
        const entries = parseYarnLock(`__metadata:
  version: 8

"lib@npm:^1.0.0":
  version: 1.0.0
  resolution: "lib@npm:1.0.0"

"lib@npm:^1.2.0":
  version: 1.2.0
  resolution: "lib@npm:1.2.0"

"lib@npm:^1.5.0":
  version: 1.5.0
  resolution: "lib@npm:1.5.0"
`);
        const { entries: after } = applyIdentifiedFixesToYarnLock(entries, new Map([
            [
                "lib",
                [
                    {
                        mergeableResolutions: ["lib@npm:1.0.0", "lib@npm:1.2.0"],
                        to: "lib@npm:1.2.0",
                    },
                    {
                        mergeableResolutions: ["lib@npm:1.2.0", "lib@npm:1.5.0"],
                        to: "lib@npm:1.5.0",
                    },
                ],
            ],
        ]));
        expect(packageEntries(after)).toHaveLength(1);
        expect(entryForDescriptor(after, "lib@npm:^1.0.0").resolution).toBe("lib@npm:1.5.0");
    });
    // two versions each said to replace the other is an instruction no rewrite
    // can honour; obeying half of it would swap the entries under them
    it("leaves both alone when two merges point at each other", () => {
        const entries = parseYarnLock(`__metadata:
  version: 8

"lib@npm:^1.0.0":
  version: 1.0.0
  resolution: "lib@npm:1.0.0"

"lib@npm:^1.2.0":
  version: 1.2.0
  resolution: "lib@npm:1.2.0"
`);
        const { entries: after, result } = applyIdentifiedFixesToYarnLock(entries, new Map([
            [
                "lib",
                [
                    { mergeableResolutions: ["lib@npm:1.0.0"], to: "lib@npm:1.2.0" },
                    { mergeableResolutions: ["lib@npm:1.2.0"], to: "lib@npm:1.0.0" },
                ],
            ],
        ]));
        expect(result.changed).toBe(false);
        expect(stringifyYarnLock(after)).toBe(stringifyYarnLock(entries));
    });
    it("keeps __metadata", () => {
        const { entries } = dedupeFixture("duplicated-printable-shell-command");
        expect(entries.__metadata).toEqual({ version: "8", cacheKey: "10c0" });
    });
});
//# sourceMappingURL=applyIdentifiedFixesToYarnLock.test.js.map