import { describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { readAndParseBunLock } from "../readAndParseBunLock.js";
import { buildPackagesMap } from "./buildPackagesMap.js";
import { parseBunLockPackages } from "./parseBunLockPackages.js";
const loadResolutionsFixture = (fileName) => {
    return JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../test/fixtures/resolutions/${fileName}`, import.meta.url)), 
    // eslint-disable-next-line unicorn/prefer-json-parse-buffer
    "utf8"));
};
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
describe("buildPackagesMap", () => {
    it("builds installation map for simple bun.lock fixture", () => {
        const fixturePath = fixturesBase("../../test/fixtures/simple/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        // simple fixture contains a single package
        strictEqual(packages.size, 1);
        const installationMap = buildPackagesMap(packages);
        // installation map should contain an entry for `semver`
        const semverResolutions = installationMap.semver;
        ok(semverResolutions);
        strictEqual(Array.isArray(semverResolutions), true);
        strictEqual(semverResolutions.length, 1);
        const resolution = semverResolutions[0];
        ok(resolution);
        strictEqual(resolution.package.name, "semver");
        deepStrictEqual(resolution.installations, ["semver"]);
        deepStrictEqual(semverResolutions, loadResolutionsFixture("semver-7.7.3.json"));
    });
    it("captures installation relation in one-dependency-of-dependency fixture", () => {
        const fixturePath = fixturesBase("../../test/fixtures/one-dependency-of-dependency/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        // fixture contains two packages
        strictEqual(packages.size, 2);
        const installationMap = buildPackagesMap(packages);
        // tagged-tag should be depended on by type-fest
        const tagged = installationMap["tagged-tag"];
        ok(tagged);
        strictEqual(Array.isArray(tagged), true);
        strictEqual(tagged.length, 1);
        ok(tagged[0]);
        strictEqual(tagged[0].package.name, "tagged-tag");
        strictEqual(tagged[0].installations.length, 1);
        strictEqual(tagged[0].installations[0], "tagged-tag");
        // TODO deepStrictEqual(tagged[0].dependents, ["type-fest"]);
        const tf = installationMap["type-fest"];
        strictEqual(Array.isArray(tf), true);
        ok(tf);
        strictEqual(tf.length, 1);
        ok(tf[0]);
        deepStrictEqual(tf[0].installations, ["type-fest"]);
        // TODO deepStrictEqual(tagged[0].dependents, []); or "package.json" ?
    });
    it("handles duplicated @babel/code-frame versions in complex fixture", () => {
        const fixturePath = fixturesBase("../../test/fixtures/duplicated-babel-frame/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        strictEqual(packages.size, 42);
        strictEqual(packages.has("@babel/code-frame"), true);
        const installationMap = buildPackagesMap(packages);
        const codeFrameDeps = installationMap["@babel/code-frame"];
        strictEqual(Array.isArray(codeFrameDeps), true);
        ok(codeFrameDeps);
        strictEqual(codeFrameDeps.length, 2); // Expecting two different versions
        ok(codeFrameDeps[0]);
        ok(codeFrameDeps[1]);
        strictEqual(codeFrameDeps[0].package.type, "npm");
        strictEqual(codeFrameDeps[0].package.version, "7.26.2");
        deepStrictEqual(codeFrameDeps[0].installations, ["@babel/code-frame"]);
        strictEqual(codeFrameDeps[1].package.type, "npm");
        strictEqual(codeFrameDeps[1].package.version, "7.27.1");
        deepStrictEqual(codeFrameDeps[1].installations, [
            "@babel/core/@babel/code-frame",
            "@babel/template/@babel/code-frame",
            "@babel/traverse/@babel/code-frame",
        ]);
        deepStrictEqual(codeFrameDeps, loadResolutionsFixture("babel-code-frame-7.26.2-7.27.1.json"));
    });
    it("handles duplicated printable-shell-command versions", () => {
        const fixturePath = fixturesBase("../../test/fixtures/duplicated-printable-shell-command/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        strictEqual(packages.size, 7);
        strictEqual(packages.has("printable-shell-command"), true);
        const installationMap = buildPackagesMap(packages);
        const resolutions = installationMap["printable-shell-command"];
        strictEqual(Array.isArray(resolutions), true);
        ok(resolutions);
        strictEqual(resolutions.length, 2); // Expecting two different versions
        deepStrictEqual(resolutions, loadResolutionsFixture("printable-shell-command-5.0.7-5.0.8.json"));
    });
});
//# sourceMappingURL=buildPackagesMap.test.js.map