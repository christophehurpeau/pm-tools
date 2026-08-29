import { afterEach, describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { stylePackageName, stylePackageReference } from "./packageStyles.js";
import { createColorize } from "./reportColors.js";
const environment = { ...process.env };
afterEach(() => {
    process.env = { ...environment };
});
const colorize = createColorize(true);
// eslint-disable-next-line no-control-regex
const escapePattern = /\u001B\[[\d;]+m/gu;
const plainText = (text) => text.replaceAll(escapePattern, "");
describe("stylePackageName", () => {
    it("returns the name untouched when colour is off", () => {
        strictEqual(stylePackageName(createColorize(false), "@babel/core"), "@babel/core");
    });
    it("styles the scope apart from the rest of the name", () => {
        const styled = stylePackageName(colorize, "@babel/core");
        strictEqual(plainText(styled), "@babel/core");
        // the two are not in the same run of escape codes
        ok(!styled.includes("@babel/core"));
    });
    it("renders the scope and the name in two shades of one hue", () => {
        delete process.env.COLORTERM;
        const styled = stylePackageName(colorize, "@babel/core");
        ok(styled.startsWith("\u001B[38;5;166m@babel/"));
        ok(styled.includes("\u001B[38;5;173mcore"));
    });
    it("switches to 24-bit colour when the terminal advertises it", () => {
        process.env.COLORTERM = "truecolor";
        ok(stylePackageName(colorize, "metro").startsWith("\u001B[38;2;215;135;95m"));
    });
    it("styles an unscoped name in one run", () => {
        strictEqual(plainText(stylePackageName(colorize, "metro")), "metro");
    });
});
describe("stylePackageReference", () => {
    it("splits the name from the version", () => {
        const styled = stylePackageReference(colorize, "metro@0.84.5");
        strictEqual(plainText(styled), "metro@0.84.5");
        ok(!styled.includes("metro@"));
    });
    it("splits past the scope", () => {
        const styled = stylePackageReference(colorize, "@babel/core@7.28.0");
        strictEqual(plainText(styled), "@babel/core@7.28.0");
        ok(!styled.includes("core@"));
    });
    it("keeps a peer suffix with the version", () => {
        const styled = stylePackageReference(colorize, "metro@0.84.5(react@19)");
        strictEqual(plainText(styled), "metro@0.84.5(react@19)");
        ok(!styled.includes("metro@"));
    });
    it("leaves a reference carrying no version untouched", () => {
        strictEqual(stylePackageReference(colorize, "package.json in devDependencies"), "package.json in devDependencies");
        strictEqual(stylePackageReference(colorize, "@babel/core"), "@babel/core");
    });
});
//# sourceMappingURL=packageStyles.test.js.map