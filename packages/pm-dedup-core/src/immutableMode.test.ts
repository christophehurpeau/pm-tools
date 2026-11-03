import { describe, expect, it } from "bun:test";
import { resolveImmutableMode } from "./immutableMode.ts";
import type { ResolveImmutableModeOptions } from "./immutableMode.ts";

const reason = "pm installs are immutable here (setting)";

const resolve = (
  options: Partial<ResolveImmutableModeOptions> &
    Pick<ResolveImmutableModeOptions, "requested">,
): { mode: string; lines: string[]; probed: boolean } => {
  const lines: string[] = [];
  let probed = false;
  const mode = resolveImmutableMode({
    reason,
    immutableDryRun: false,
    color: false,
    log: (message = "") => lines.push(message),
    ...options,
    isImmutable: () => {
      probed = true;
      return options.isImmutable?.() ?? true;
    },
  });
  return { mode, lines, probed };
};

describe("resolveImmutableMode", () => {
  it("keeps an apply where installs can write the lockfile, silently", () => {
    const { mode, lines } = resolve({
      requested: "apply",
      isImmutable: () => false,
    });
    expect(mode).toBe("apply");
    expect(lines).toEqual([]);
  });

  it("turns an apply into a check, saying so and how not to fail", () => {
    const { mode, lines } = resolve({ requested: "apply" });
    expect(mode).toBe("check");
    expect(lines).toEqual([
      `${reason}: running as --check, nothing is written.`,
      "Pass --immutable-dry-run to report the plan without failing; run it where installs are writable to apply it.",
      "",
    ]);
  });

  it("turns an apply into a dry run with --immutable-dry-run, still saying so", () => {
    const { mode, lines } = resolve({
      requested: "apply",
      immutableDryRun: true,
    });
    expect(mode).toBe("dry-run");
    expect(lines).toEqual([
      `${reason}: running as --dry-run, nothing is written.`,
      "",
    ]);
  });

  it("leaves an explicit --check or --dry-run alone without probing", () => {
    for (const requested of ["check", "dry-run"] as const) {
      const { mode, lines, probed } = resolve({ requested });
      expect(mode).toBe(requested);
      expect(lines).toEqual([]);
      expect(probed).toBe(false);
    }
  });
});
