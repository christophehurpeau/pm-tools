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
// a block whose other declarations carry protocols the parser has no list for:
// they have to parse so the target rewrite is not aborted by a neighbour
const manifestWithProtocols = [
    "{",
    '  "name": "root",',
    '  "dependencies": {',
    '    "local": "workspace:^1.0.0",',
    '    "vendored": "someproto:whatever",',
    '    "forked": "git+ssh://git@host/r.git#v1",',
    '    "metro": "^0.84.5"',
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
    it("rewrites past siblings declared with protocols it does not know", () => {
        strictEqual(applyWorkspaceRangeEdit(manifestWithProtocols, {
            packageName: "metro",
            depType: "dependencies",
            range: "^0.84.5",
            to: "0.87.0",
        }), manifestWithProtocols.replace('"metro": "^0.84.5"', '"metro": "^0.87.0"'));
    });
    // the range reaches here already stripped of its protocol, and `stringify`
    // puts it back: rewriting `workspace:^1.0.0` to a bare `2.0.0` would change
    // which package the declaration points at
    it("keeps a workspace protocol on the rewritten declaration", () => {
        strictEqual(applyWorkspaceRangeEdit(manifestWithProtocols, {
            packageName: "local",
            depType: "dependencies",
            range: "^1.0.0",
            to: "2.0.0",
        }), manifestWithProtocols.replace('"local": "workspace:^1.0.0"', '"local": "workspace:^2.0.0"'));
    });
    it("edits an aliased declaration through its own key", () => {
        strictEqual(applyWorkspaceRangeEdit([
            "{",
            '  "dependencies": {',
            '    "aliased": "npm:metro@^0.84.5"',
            "  }",
            "}",
            "",
        ].join("\n"), {
            packageName: "metro",
            depType: "dependencies",
            range: "^0.84.5",
            to: "0.87.0",
        })?.includes('"aliased": "npm:metro@^0.87.0"'), true);
    });
    // The manifest key `typescript` is an alias for another package entirely,
    // while the real `typescript` is reached through `@typescript/native`. Keying
    // the rewrite on the package name would edit the wrong line in both
    // directions.
    it("edits the key an alias reaches the package through, not its namesake", () => {
        const swapped = [
            "{",
            '  "devDependencies": {',
            '    "@typescript/native": "npm:typescript@^7.0.0",',
            '    "typescript": "npm:@typescript/typescript6@6.0.2"',
            "  }",
            "}",
            "",
        ].join("\n");
        strictEqual(applyWorkspaceRangeEdit(swapped, {
            packageName: "typescript",
            depType: "devDependencies",
            range: "^7.0.0",
            to: "7.1.0",
        }), swapped.replace('"npm:typescript@^7.0.0"', '"npm:typescript@^7.1.0"'));
        strictEqual(applyWorkspaceRangeEdit(swapped, {
            packageName: "@typescript/typescript6",
            depType: "devDependencies",
            range: "6.0.2",
            to: "6.1.0",
        }), swapped.replace('"npm:@typescript/typescript6@6.0.2"', '"npm:@typescript/typescript6@6.1.0"'));
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