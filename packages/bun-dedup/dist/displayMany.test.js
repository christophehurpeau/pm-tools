import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";
import { displayMany } from "./displayMany.js";
import { buildPackagesMap, filterDuplicatesPackagesMap, } from "./helpers/buildPackagesMap.js";
import { collectDependents } from "./helpers/collectDependents.js";
import { parseBunLockPackages } from "./helpers/parseBunLockPackages.js";
import { identifyClusterFixes } from "./identifyClusterFixes.js";
import { readAndParseBunLock } from "./readAndParseBunLock.js";
// The report layout is covered in pm-utils (`renderDuplicatesReport`); these
// only check that the bun.lock model is mapped onto it correctly.
const render = (scenario, overrides = {}) => {
    const fixturePath = fileURLToPath(new URL(`../test/fixtures/${scenario}/bun.lock`, import.meta.url));
    const bunLock = readAndParseBunLock(fixturePath);
    const packages = parseBunLockPackages(bunLock);
    const packagesMap = buildPackagesMap(packages);
    const duplicates = filterDuplicatesPackagesMap(packagesMap);
    const dependents = collectDependents(packages, bunLock.workspaces, Object.keys(duplicates));
    let buffer = "";
    displayMany({
        title: "duplicates",
        duplicatesPackagesMap: duplicates,
        dependents,
        totalDependencies: Object.keys(packagesMap).length,
        details: true,
        color: false,
        log: (message = "") => {
            buffer += `${message}\n`;
        },
        ...overrides,
    });
    return buffer;
};
const clusterFixesOf = (scenario) => {
    const fixturePath = fileURLToPath(new URL(`../test/fixtures/${scenario}/bun.lock`, import.meta.url));
    const bunLock = readAndParseBunLock(fixturePath);
    const packages = parseBunLockPackages(bunLock);
    return identifyClusterFixes(buildPackagesMap(packages), packages, bunLock.workspaces);
};
const lastLine = (output) => output.trimEnd().split("\n").at(-1);
describe("displayMany", () => {
    it("groups every dependent under the version it got, with its install paths", () => {
        expect(render("duplicated-babel-frame")).toBe(`Found 1 duplicate:

@babel/code-frame — 2 versions
  7.27.1
    - @babel/core                   requires "^7.25.9"
    - @babel/template               requires "^7.27.1"
    - @babel/traverse               requires "^7.27.1"
    installed at: @babel/core/@babel/code-frame, @babel/template/@babel/code-frame, @babel/traverse/@babel/code-frame
  7.26.2
    - package.json in dependencies  requires "7.26.2"

Found 39 dependencies, 1 duplicate, 0 dedupable.
`);
    });
    it("gives one line per package without --details", () => {
        expect(render("duplicated-babel-frame", { details: false })).toBe(`Found 1 duplicate:

- @babel/code-frame  resolved to 2 versions (7.27.1, 7.26.2)

Found 39 dependencies, 1 duplicate, 0 dedupable.
Run \`bun-why-duplicate --details\` to see every dependent.
`);
    });
    it("renders duplicates for printable-shell-command", () => {
        expect(render("duplicated-printable-shell-command")).toBe(`Found 1 duplicate:

printable-shell-command — 2 versions
  5.0.8
    - betterdisplaycli              requires "^5.0.8"
  5.0.7
    - package.json in dependencies  requires "^5.0.7"

Found 6 dependencies, 1 duplicate, 0 dedupable.
`);
    });
    // `exact-pin-forces-downgrade`: bun.lock records `expo-camera`'s `^3.0.0`
    // next to the 3.2.2 it resolved to, so the caret is filed under 3.2.2 instead
    // of reading like an exact pin, and the pin that keeps 3.0.3 alive is named.
    it("files a range under the version it resolved to", () => {
        expect(render("exact-pin-forces-downgrade")).toContain(`barcode-detector — 2 versions
  3.2.2
    - expo-camera               requires "^3.0.0"
  3.0.3
    - @yudiel/react-qr-scanner  requires "3.0.3"
`);
    });
    it("names the downgrade a merge onto an installed copy takes", () => {
        const output = render("exact-pin-forces-downgrade", {
            identifiedFixesMap: new Map([
                [
                    "barcode-detector",
                    [
                        {
                            mergeableResolutions: [
                                "barcode-detector@3.0.3",
                                "barcode-detector@3.2.2",
                            ],
                            to: "barcode-detector@3.0.3",
                        },
                    ],
                ],
            ]),
        });
        expect(output).toContain("barcode-detector — 2 versions, can be deduped to 3.0.3 (downgrade)\n");
        expect(output).toContain("  3.2.2  can be deduped to 3.0.3 (downgrade)\n");
    });
    it("lists every nested duplicate for typescript-eslint", () => {
        const output = render("duplicated-typescript-eslint");
        expect(output).toStartWith("Found 16 duplicates:\n");
        expect(output).toContain("@typescript-eslint/types — 2 versions");
        expect(output).toContain('- eslint-plugin-import-x                      requires "^8.56.0"');
        // the nested dependent keys bun records are kept verbatim
        expect(output).toContain('- @typescript-eslint/utils/@typescript-eslint/typescript-estree  requires "8.59.1"');
    });
    it("maps a resolution fix to the versions that would collapse", () => {
        const fixes = [
            {
                mergeableResolutions: [
                    "printable-shell-command@5.0.7",
                    "printable-shell-command@5.0.8",
                ],
                to: "printable-shell-command@5.0.8",
            },
        ];
        const output = render("duplicated-printable-shell-command", {
            identifiedFixesMap: new Map([["printable-shell-command", fixes]]),
        });
        expect(output).toContain("printable-shell-command — 2 versions, can be deduped to 5.0.8 (upgrade)\n");
        expect(output).toContain("  5.0.7  can be deduped to 5.0.8 (upgrade)\n");
        expect(lastLine(output)).toBe("Found 6 dependencies, 1 duplicate, at least 1 dedupable (deduping may remove more). Run `bun-dedupe` to apply.");
    });
    it("renders the lockstep cluster fix for typescript-eslint", () => {
        const output = render("duplicated-typescript-eslint", {
            clusterFixes: clusterFixesOf("duplicated-typescript-eslint"),
        });
        expect(output).toContain("Lockstep clusters:");
        expect(output).toContain("cluster 1 — @typescript-eslint/* (+1 more) [11 packages, 7 duplicated, 7 fixable]:");
        expect(output).toContain("  Dedupe: 8.59.1 (downgrade)");
        // every member is listed with what it currently has installed
        expect(output).toContain("    - typescript-eslint  ");
        expect(output).toContain("8.61.0, 8.59.1");
        // and the members are cross-referenced back to it, with the target the
        // family converges on — which nothing about the package alone would say
        expect(output).toContain("@typescript-eslint/types — 2 versions, can be deduped to 8.59.1 (downgrade) (cluster 1)\n");
    });
    // `aliased-swapped-names`: with `typescript` also used as a key for another
    // package, "package.json in devDependencies requires 7.0.2" is ambiguous on
    // its own — the declaration it came from has to be named.
    it("names the key an aliased dependent declares the package under", () => {
        const output = render("aliased-swapped-names");
        expect(output).toContain('package.json in devDependencies (as "@typescript/native")  requires "7.0.2"');
        // the aliased key is past the column budget, so it overflows on its own
        // instead of clamping the column below what the other row needs
        expect(output).toContain('- tool  requires "^5.9.0"');
    });
    it("names the bun command in the summary", () => {
        const output = render("duplicated-typescript-eslint", {
            clusterFixes: clusterFixesOf("duplicated-typescript-eslint"),
        });
        expect(lastLine(output)).toEndWith("Run `bun-dedupe` to apply.");
    });
    it("points a listing at the tree", () => {
        const output = render("duplicated-typescript-eslint", { details: false });
        expect(lastLine(output)).toBe("Run `bun-why-duplicate --details` to see every dependent.");
    });
});
//# sourceMappingURL=displayMany.test.js.map