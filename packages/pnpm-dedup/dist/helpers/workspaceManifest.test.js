import { describe, it } from "bun:test";
import { strictEqual } from "node:assert/strict";
import { applyWorkspaceRangeEdit, nextSelector } from "./workspaceManifest.js";
const manifest = [
    "{",
    '  "name": "root",',
    '  "dependencies": {',
    '    "metro": "0.84.5"',
    "  },",
    '  "devDependencies": {',
    '    "metro": "^0.84.5",',
    '    "lodash.merge": "~4.6.0",',
    '    "aliased": "npm:metro@^0.84.5"',
    "  }",
    "}",
    "",
].join("\n");
describe("nextSelector", () => {
    it("keeps a caret or tilde on the target line", () => {
        strictEqual(nextSelector("^0.84.5", "0.87.0"), "^0.87.0");
        strictEqual(nextSelector("~4.6.0", "4.7.1"), "~4.7.1");
    });
    it("pins exactly when the range has no target-line equivalent", () => {
        strictEqual(nextSelector("0.84.5", "0.87.0"), "0.87.0");
        strictEqual(nextSelector("*", "0.87.0"), "0.87.0");
        strictEqual(nextSelector("0.83 - 0.86", "0.87.0"), "0.87.0");
        strictEqual(nextSelector("^0.83 - 0.86", "0.87.0"), "0.87.0");
    });
});
describe("applyWorkspaceRangeEdit", () => {
    it("edits only the declaration in the requested depType", () => {
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "metro",
            depType: "devDependencies",
            range: "^0.84.5",
            to: "0.87.0",
        }), manifest.replace('"metro": "^0.84.5"', '"metro": "^0.87.0"'));
    });
    it("edits the exact pin in dependencies without touching devDependencies", () => {
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "metro",
            depType: "dependencies",
            range: "0.84.5",
            to: "0.87.0",
        }), manifest.replace('"metro": "0.84.5"', '"metro": "0.87.0"'));
    });
    it("keeps the npm: alias prefix", () => {
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "metro",
            depType: "devDependencies",
            range: "^0.84.5",
            to: "0.87.0",
        })?.includes('"aliased": "npm:metro@^0.84.5"'), true);
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "metro",
            depType: "devDependencies",
            range: "^0.84.5",
            to: "0.87.0",
        })?.includes('"metro": "^0.87.0"'), true);
    });
    it("matches a dotted name literally", () => {
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "lodash.merge",
            depType: "devDependencies",
            range: "~4.6.0",
            to: "4.7.1",
        }), manifest.replace('"lodash.merge": "~4.6.0"', '"lodash.merge": "~4.7.1"'));
    });
    it("reports a declaration that moved on since the lockfile was read", () => {
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "metro",
            depType: "devDependencies",
            range: "^0.80.0",
            to: "0.87.0",
        }), undefined);
        strictEqual(applyWorkspaceRangeEdit(manifest, {
            packageName: "metro",
            depType: "optionalDependencies",
            range: "^0.84.5",
            to: "0.87.0",
        }), undefined);
    });
});
//# sourceMappingURL=workspaceManifest.test.js.map