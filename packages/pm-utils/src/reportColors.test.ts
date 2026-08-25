import { afterEach, describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { createColorize, shouldColorize } from "./reportColors.ts";

const environment = { ...process.env };

afterEach(() => {
  process.env = { ...environment };
});

describe("createColorize", () => {
  it("returns the text untouched when disabled", () => {
    strictEqual(createColorize(false)(["bold", "cyan"], "metro"), "metro");
  });

  it("wraps the text when enabled", () => {
    const wrapped = createColorize(true)("dim", "metro");
    ok(wrapped.includes("metro"));
    ok(wrapped.length > "metro".length);
  });
});

describe("shouldColorize", () => {
  it("follows the stream when nothing forces the decision", () => {
    delete process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    delete process.env.TERM;
    strictEqual(shouldColorize({ isTTY: true }), true);
    strictEqual(shouldColorize({ isTTY: false }), false);
    strictEqual(shouldColorize({}), false);
  });

  it("honours FORCE_COLOR over a piped stream", () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = "1";
    strictEqual(shouldColorize({ isTTY: false }), true);
  });

  it("ignores FORCE_COLOR=0", () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = "0";
    strictEqual(shouldColorize({ isTTY: false }), false);
  });

  it("honours NO_COLOR over a TTY", () => {
    delete process.env.FORCE_COLOR;
    process.env.NO_COLOR = "1";
    strictEqual(shouldColorize({ isTTY: true }), false);
  });

  it("refuses a dumb terminal", () => {
    delete process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    process.env.TERM = "dumb";
    strictEqual(shouldColorize({ isTTY: true }), false);
  });
});
