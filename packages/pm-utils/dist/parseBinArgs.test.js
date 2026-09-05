import { afterEach, describe, it } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { parseBinArgs } from "./parseBinArgs.js";
const usage = "Usage: tool [options]";
const originalLog = console.log;
const originalError = console.error;
afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
});
// `process.exitCode` is the test runner's own, so the error path has to hand it
// back untouched.
const withCapturedOutput = (run) => {
    const lines = [];
    const record = (message = "") => {
        lines.push(message);
    };
    console.log = record;
    console.error = record;
    const exitCodeBefore = process.exitCode;
    try {
        return { result: run(), output: lines.join("\n") };
    }
    finally {
        if (process.exitCode !== exitCodeBefore) {
            // bun ignores `process.exitCode = undefined` (node resets it), so the
            // whole run would end on 1 with every test passing.
            process.exitCode = exitCodeBefore ?? 0;
        }
    }
};
describe("parseBinArgs", () => {
    const parse = (args) => parseBinArgs(usage, {
        args,
        options: { check: { type: "boolean" } },
        allowPositionals: true,
    });
    it("parses the arguments it knows", () => {
        const parsed = parse(["--check", "lodash"]);
        // `parseArgs` returns a null-prototype `values`, and `deepStrictEqual`
        // compares prototypes.
        deepStrictEqual(parsed?.values, { __proto__: null, check: true });
        deepStrictEqual(parsed?.positionals, ["lodash"]);
    });
    it("prints the usage and stops on --help", () => {
        const { result, output } = withCapturedOutput(() => parse(["--help"]));
        strictEqual(result, null);
        strictEqual(output, usage);
        strictEqual(process.exitCode, undefined);
    });
    it("names an unknown flag and fails instead of ignoring it", () => {
        const { result, output } = withCapturedOutput(() => {
            const parsed = parse(["--chekc"]);
            strictEqual(process.exitCode, 1);
            return parsed;
        });
        strictEqual(result, null);
        strictEqual(output.includes("--chekc"), true);
        strictEqual(output.includes(usage), true);
    });
});
//# sourceMappingURL=parseBinArgs.test.js.map