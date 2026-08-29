import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { renderDedupeSummary } from "./renderDedupeSummary.js";
const render = (overrides = {}) => {
    let output = "";
    renderDedupeSummary({
        deduped: [
            { packageName: "semver", before: ["7.5.4", "7.7.1"], after: ["7.7.1"] },
        ],
        remainingDuplicates: 0,
        whyCommand: "bun-why-duplicate",
        color: false,
        log: (message = "") => {
            output += `${message}\n`;
        },
        ...overrides,
    });
    return output;
};
const lines = (output) => output.trimEnd().split("\n");
describe("renderDedupeSummary", () => {
    it("counts and names both sides, one package per line", () => {
        strictEqual(render({
            deduped: [
                {
                    packageName: "@typescript-eslint/parser",
                    before: ["8.1.0", "8.2.0", "8.3.0"],
                    after: ["8.3.0"],
                },
                {
                    packageName: "range-parser",
                    before: ["1.2.1", "1.3.0"],
                    after: ["1.2.1"],
                },
            ],
        }), [
            "Deduped 2 packages, 3 copies merged:",
            "  @typescript-eslint/parser: 3 versions (8.1.0, 8.2.0, 8.3.0) -> 1 version (8.3.0)",
            "  range-parser:              2 versions (1.2.1, 1.3.0) -> 1 version (1.2.1)",
            "No duplicate left.",
            "",
        ].join("\n"));
    });
    // the counts are what say a copy went away: a bare `1.3.0 -> 1.2.1` reads as
    // a downgrade the tool chose
    it("keeps the surviving version alongside its count", () => {
        ok(render().includes("  semver: 2 versions (7.5.4, 7.7.1) -> 1 version (7.7.1)\n"));
    });
    it("names what is left of a package only partly collapsed", () => {
        ok(render({
            deduped: [
                {
                    packageName: "react",
                    before: ["17.0.2", "18.2.0", "19.0.0"],
                    after: ["18.2.0", "19.0.0"],
                },
            ],
            remainingDuplicates: 1,
        }).includes("  react: 3 versions (17.0.2, 18.2.0, 19.0.0) -> 2 versions (18.2.0, 19.0.0)\n"));
    });
    it("summarises a package resolved more times than the line can hold", () => {
        ok(render({
            deduped: [
                {
                    packageName: "@types/node",
                    before: [
                        "18.0.0",
                        "20.0.0",
                        "20.1.0",
                        "22.0.0",
                        "22.1.0",
                        "24.0.0",
                    ],
                    after: ["24.0.0"],
                },
            ],
        }).includes("6 versions (18.0.0, 20.0.0, 20.1.0, 22.0.0, 22.1.0, +1 more) -> 1 version (24.0.0)"));
    });
    it("points at the why command for what is left", () => {
        strictEqual(lines(render({ remainingDuplicates: 3 })).at(-1), "3 duplicates left — run `bun-why-duplicate` to see them.");
        strictEqual(lines(render({ remainingDuplicates: 1 })).at(-1), "1 duplicate left — run `bun-why-duplicate` to see it.");
    });
    // the caller has its own wording for a run that changed nothing
    it("prints nothing when nothing was deduped", () => {
        strictEqual(render({ deduped: [], remainingDuplicates: 4 }), "");
    });
    it("colours the versions when asked", () => {
        ok(render({ color: true }).includes("["));
    });
});
//# sourceMappingURL=renderDedupeSummary.test.js.map