import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { nestedRunEnv, skipNestedRun } from "./nestedRun.ts";

describe("nested runs", () => {
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => errorSpy.mockClear());

  it("runs when no dedupe run spawned it", () => {
    expect(skipNestedRun("bun-dedupe", {})).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("skips, saying why, under the environment a dedupe run spawns with", () => {
    expect(skipNestedRun("bun-dedupe", nestedRunEnv({}))).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      "bun-dedupe: skipped, started by an install another dedupe run is driving",
    );
  });

  it("keeps the rest of the environment", () => {
    expect(nestedRunEnv({ PATH: "/bin" }).PATH).toBe("/bin");
  });
});
