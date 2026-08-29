import { describe, expect, it } from "bun:test";
import { addResolutions } from "./packageJsonResolutions.js";
describe("addResolutions", () => {
    it("adds a resolutions block, keeping the file's indentation", () => {
        const content = `{\n    "name": "app"\n}\n`;
        expect(addResolutions(content, new Map([["lodash", "4.17.21"]]))).toBe(`{\n    "name": "app",\n    "resolutions": {\n        "lodash": "4.17.21"\n    }\n}\n`);
    });
    it("merges into the resolutions already declared", () => {
        const content = `{\n  "resolutions": {\n    "semver": "7.7.3"\n  }\n}\n`;
        expect(JSON.parse(addResolutions(content, new Map([["lodash", "4.17.21"]])))).toEqual({ resolutions: { semver: "7.7.3", lodash: "4.17.21" } });
    });
    it("overwrites a resolution already there", () => {
        const content = `{\n  "resolutions": {\n    "lodash": "4.0.0"\n  }\n}\n`;
        expect(JSON.parse(addResolutions(content, new Map([["lodash", "4.17.21"]])))).toEqual({ resolutions: { lodash: "4.17.21" } });
    });
});
//# sourceMappingURL=packageJsonResolutions.test.js.map