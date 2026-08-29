import { describe, expect, it } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProjects } from "./helpers/tempProjects.ts";
import { readAndParseYarnLock } from "./readYarnLock.ts";

const projects = createTempProjects("yarn-berry-deduplicate-read-");

const lockPath = (content: string): string => {
  const path = join(projects.create(), "yarn.lock");
  writeFileSync(path, content);
  return path;
};

describe("readAndParseYarnLock", () => {
  it("reads a berry lockfile", () => {
    const entries = readAndParseYarnLock(
      lockPath(`__metadata:
  version: 8

"lodash@npm:^4.17.0":
  version: 4.17.21
  resolution: "lodash@npm:4.17.21"
`),
    );

    expect(entries.__metadata).toEqual({ version: "8" });
  });

  // corepack answers a bare `yarn` with 1.x wherever no `packageManager` is
  // pinned, so this is a lockfile a user can plausibly be standing in front of
  it("refuses a yarn classic lockfile instead of reporting nothing", () => {
    expect(() =>
      readAndParseYarnLock(
        lockPath(`# yarn lockfile v1

lodash@^4.17.0:
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz#aaa"
`),
      ),
    ).toThrow("it is not a yarn berry lockfile");
  });
});
