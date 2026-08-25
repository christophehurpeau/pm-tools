import { describe, it } from "bun:test";
import { ok, strictEqual } from "node:assert/strict";
import { renderApplyPlan } from "./renderApplyPlan.ts";
import type { ApplyPlanOptions } from "./renderApplyPlan.ts";

const escapeStart = "\u001B[";

const render = (
  overrides: Partial<ApplyPlanOptions> = {},
): { output: string; changeCount: number } => {
  let output = "";
  const { changeCount } = renderApplyPlan({
    fileChanges: [
      {
        path: "package.json",
        changes: ['"metro": "0.84.5" -> "0.87.0" (devDependencies)'],
      },
    ],
    dedupeCommand: "pnpm-dedupe",
    color: false,
    log: (message = "") => {
      output += `${message}\n`;
    },
    ...overrides,
  });
  return { output, changeCount };
};

const lastLine = (output: string): string =>
  output.trimEnd().split("\n").at(-1)!;

describe("renderApplyPlan", () => {
  it("renders the changes per file and counts them", () => {
    const { output, changeCount } = render();
    strictEqual(changeCount, 1);
    ok(output.startsWith("Would apply:\n"));
    ok(output.includes("package.json:"));
    ok(output.includes('  - "metro": "0.84.5" -> "0.87.0" (devDependencies)'));
    strictEqual(
      lastLine(output),
      "1 change in 1 file. Run `pnpm-dedupe` to apply.",
    );
  });

  it("pluralizes changes and files", () => {
    const { output, changeCount } = render({
      fileChanges: [
        { path: "package.json", changes: ["a", "b"] },
        { path: "packages/app/package.json", changes: ["c"] },
      ],
    });
    strictEqual(changeCount, 3);
    strictEqual(
      lastLine(output),
      "3 changes in 2 files. Run `pnpm-dedupe` to apply.",
    );
  });

  it("marks a file that is only touched for the run", () => {
    const { output } = render({
      fileChanges: [
        {
          path: "pnpm-workspace.yaml",
          transient: "removed once the result is verified",
          changes: ['"metro@": "0.87.0" (converge)'],
        },
      ],
    });
    ok(
      output.includes(
        "pnpm-workspace.yaml (transient, removed once the result is verified):",
      ),
    );
  });

  it("skips a file with no change of its own", () => {
    const { output, changeCount } = render({
      fileChanges: [
        { path: "package.json", changes: ["a"] },
        { path: "pnpm-workspace.yaml", changes: [] },
      ],
    });
    strictEqual(changeCount, 1);
    ok(!output.includes("pnpm-workspace.yaml"));
    ok(lastLine(output).startsWith("1 change in 1 file."));
  });

  it("reports what the plan gave up on", () => {
    const { output } = render({
      skipped: ["metro-config: keeping 0.87.0, ignoring 0.84.5"],
    });
    ok(output.includes("Skipped:"));
    ok(output.includes("  - metro-config: keeping 0.87.0, ignoring 0.84.5"));
  });

  it("reports what the package manager would still change", () => {
    const { output } = render({
      packageManagerResiduals: "`pnpm dedupe` would also change the lockfile.",
    });
    ok(output.includes("`pnpm dedupe` would also change the lockfile."));
  });

  it("says nothing to do when there is no change and no residual", () => {
    const { output, changeCount } = render({ fileChanges: [] });
    strictEqual(changeCount, 0);
    strictEqual(output, "Nothing to dedupe.\n");
  });

  it("still points at the command when only the package manager would act", () => {
    const { output, changeCount } = render({
      fileChanges: [],
      packageManagerResiduals: "`pnpm dedupe` would also change the lockfile.",
    });
    strictEqual(changeCount, 0);
    ok(!output.includes("Would apply:"));
    strictEqual(lastLine(output), "Run `pnpm-dedupe` to apply.");
  });

  it("reports what was skipped even with nothing to apply", () => {
    const { output } = render({
      fileChanges: [],
      skipped: ["metro in packages/app: no workspace file recorded for it"],
    });
    ok(
      output.includes(
        "  - metro in packages/app: no workspace file recorded for it",
      ),
    );
    ok(output.includes("Nothing to dedupe."));
  });

  it("emits no escape codes with color off, and some with it on", () => {
    ok(!render().output.includes(escapeStart));
    ok(render({ color: true }).output.includes(escapeStart));
  });
});
