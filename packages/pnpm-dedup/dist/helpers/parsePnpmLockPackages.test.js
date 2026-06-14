import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readPnpmLock } from "../readPnpmLock.js";
import { parsePackageId, parsePnpmLockPackages, } from "./parsePnpmLockPackages.js";
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readFixture = (scenario) => readPnpmLock(fixturesBase(`../../test/fixtures/${scenario}/pnpm-lock.yaml`));
describe("parsePackageId", () => {
    it("parses an unscoped id", () => {
        deepStrictEqual(parsePackageId("semver@7.7.3"), {
            name: "semver",
            version: "7.7.3",
        });
    });
    it("parses a scoped id", () => {
        deepStrictEqual(parsePackageId("@babel/code-frame@7.26.2"), {
            name: "@babel/code-frame",
            version: "7.26.2",
        });
    });
    it("strips the peer-dependency suffix", () => {
        deepStrictEqual(parsePackageId("@typescript-eslint/utils@8.61.0(eslint@10.5.0)(typescript@6.0.3)"), { name: "@typescript-eslint/utils", version: "8.61.0" });
    });
    it("keeps a non-registry url as the version", () => {
        const parsed = parsePackageId("zod@https://codeload.github.com/colinhacks/zod/tar.gz/ca42965df46b2f7e2747db29c40a26bcb32a51d5");
        strictEqual(parsed.name, "zod");
        strictEqual(parsed.version.startsWith("https://"), true);
    });
});
describe("parsePnpmLockPackages", () => {
    it("parses the simple fixture (single npm package)", () => {
        const { packages } = parsePnpmLockPackages(readFixture("simple"));
        strictEqual(packages.size, 1);
        const semver = packages.get("semver@7.7.3");
        strictEqual(semver?.type, "npm");
        strictEqual(semver.name, "semver");
        strictEqual(semver.version, "7.7.3");
    });
    it("parses both duplicated @babel/code-frame versions as npm", () => {
        const { packages } = parsePnpmLockPackages(readFixture("duplicated-babel-frame"));
        const codeFrames = [...packages.values()].filter((pkg) => pkg.name === "@babel/code-frame");
        strictEqual(codeFrames.length, 2);
        ok(codeFrames.every((pkg) => pkg.type === "npm"));
        const versions = new Set(codeFrames.map((pkg) => pkg.version));
        ok(versions.has("7.26.2"));
        ok(versions.size === 2);
    });
    it("classifies non-registry resolutions as other, registry tarballs as npm", () => {
        const { packages } = parsePnpmLockPackages(readFixture("non-npm"));
        const byName = new Map([...packages.values()].map((pkg) => [pkg.name, pkg]));
        strictEqual(byName.get("react")?.type, "npm");
        strictEqual(byName.get("zod")?.type, "other");
    });
    it("groups peer-context snapshots into installations", () => {
        const { installationsByResolution } = parsePnpmLockPackages(readFixture("duplicated-typescript-eslint"));
        const utils = installationsByResolution.get("@typescript-eslint/utils@8.61.0");
        ok(utils);
        ok(utils.length > 0);
        ok(utils.every((key) => key.startsWith("@typescript-eslint/utils@8.61.0")));
    });
});
//# sourceMappingURL=parsePnpmLockPackages.test.js.map