import { describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { addOverrides, overrideKey, readConvergenceOverrides, } from "./pnpmWorkspaceYaml.js";
const overrides = (entries) => new Map(entries);
describe("pnpmWorkspaceYaml", () => {
    it("uses the empty range selector pnpm reads as a convergence override", () => {
        strictEqual(overrideKey("metro-config", true), "metro-config@");
        strictEqual(overrideKey("@react-native/metro-config", true), "@react-native/metro-config@");
        strictEqual(overrideKey("metro-config", false), "metro-config");
    });
    it("creates the file content when there is none", () => {
        strictEqual(addOverrides(undefined, overrides([["metro-config", "0.87.0"]])), 'overrides:\n  "metro-config@": "0.87.0"\n');
    });
    it("keeps comments, sibling keys and formatting", () => {
        const content = [
            "# why this repo pins its resolution mode",
            "resolutionMode: time-based # inline",
            "",
            "packages:",
            "  - packages/*",
            "",
            "# trailing note",
            "",
        ].join("\n");
        strictEqual(addOverrides(content, overrides([["metro", "0.84.5"]])), [
            "# why this repo pins its resolution mode",
            "resolutionMode: time-based # inline",
            "",
            "packages:",
            "  - packages/*",
            "overrides:",
            '  "metro@": "0.84.5"',
            "",
            "# trailing note",
            "",
        ].join("\n"));
    });
    it("adds to an existing overrides block without touching its entries", () => {
        const content = [
            "overrides:",
            "  # a decision taken elsewhere",
            '  "foo@": "1.0.0"',
            "resolutionMode: time-based",
            "",
        ].join("\n");
        strictEqual(addOverrides(content, overrides([["bar", "2.0.0"]])), [
            "overrides:",
            "  # a decision taken elsewhere",
            '  "foo@": "1.0.0"',
            '  "bar@": "2.0.0"',
            "resolutionMode: time-based",
            "",
        ].join("\n"));
    });
    it("quotes the scoped keys and the versions yaml would read as numbers", () => {
        strictEqual(addOverrides(undefined, overrides([
            ["@react-native/metro-config", "0.87.0"],
            ["single-digit", "4"],
        ])), [
            "overrides:",
            '  "@react-native/metro-config@": "0.87.0"',
            '  "single-digit@": "4"',
            "",
        ].join("\n"));
    });
    it("puts the comment above the first entry it adds, not above the block", () => {
        strictEqual(addOverrides('overrides:\n  # a decision taken elsewhere\n  "foo@": "1.0.0"\n', overrides([
            ["leaf", "2.0.0"],
            ["other", "1.0.0"],
        ]), { comment: "Added by pnpm-dedup.\nsee https://example.test/issues" }), [
            "overrides:",
            "  # a decision taken elsewhere",
            '  "foo@": "1.0.0"',
            "  # Added by pnpm-dedup.",
            "  # see https://example.test/issues",
            '  "leaf@": "2.0.0"',
            '  "other@": "1.0.0"',
            "",
        ].join("\n"));
    });
    it("writes plain keys when convergence is disabled", () => {
        strictEqual(addOverrides(undefined, overrides([["metro", "0.84.5"]]), {
            convergence: false,
        }), 'overrides:\n  "metro": "0.84.5"\n');
    });
    it("reads back only the convergence overrides", () => {
        const content = addOverrides('overrides:\n  "plain-override": "1.0.0"\n', overrides([["metro", "0.84.5"]]));
        deepStrictEqual([...readConvergenceOverrides(content)], [["metro", "0.84.5"]]);
    });
});
//# sourceMappingURL=pnpmWorkspaceYaml.test.js.map