import { describe, expect, it } from "bun:test";
import { ok } from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { readAndParseBunLock } from "../readAndParseBunLock.js";
import { collectDependents } from "./collectDependents.js";
import { parseBunLockPackages } from "./parseBunLockPackages.js";
const loadDependentsFixture = (fileName) => {
    return JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../test/fixtures/dependents/${fileName}`, import.meta.url)), 
    // eslint-disable-next-line unicorn/prefer-json-parse-buffer
    "utf8"));
};
const fixturesBase = (rel) => fileURLToPath(new URL(rel, import.meta.url));
describe("collectDependents", () => {
    it("collects dependents for simple package", () => {
        const fixturePath = fixturesBase("../../test/fixtures/simple/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces);
        expect(Object.fromEntries(dependents)).toEqual(loadDependentsFixture("semver-7.7.3.json"));
    });
    it("finds no dependents for @babel/core in duplicated-babel-frame fixture (peerDependencies not counted)", () => {
        const fixturePath = fixturesBase("../../test/fixtures/duplicated-babel-frame/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces, [
            "@babel/core",
        ]);
        const dependentsForCore = dependents.get("@babel/core");
        ok(dependentsForCore);
        expect(dependentsForCore).toBeArrayOfSize(1);
        expect(dependentsForCore[0]).toMatchObject({
            key: "package.json in dependencies",
        });
    });
    it("finds dependents for @babel/code-frame in duplicated-babel-frame fixture", () => {
        const fixturePath = fixturesBase("../../test/fixtures/duplicated-babel-frame/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces, [
            "@babel/code-frame",
        ]);
        const dependentsForCodeFrame = dependents.get("@babel/code-frame");
        expect(dependentsForCodeFrame).toBeArrayOfSize(4);
        const dependentKeys = dependentsForCodeFrame?.map((d) => d.key);
        expect(dependentKeys).toEqual([
            "package.json in dependencies",
            "@babel/core",
            "@babel/template",
            "@babel/traverse",
        ]);
        expect(Object.fromEntries(dependents)).toEqual(loadDependentsFixture("babel-code-frame-7.26.2-7.27.1.json"));
    });
    it("finds dependents for printable-shell-command in duplicated-printable-shell-command fixture", () => {
        const fixturePath = fixturesBase("../../test/fixtures/duplicated-printable-shell-command/bun.lock");
        const bunLock = readAndParseBunLock(fixturePath);
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces, [
            "printable-shell-command",
        ]);
        expect(Object.fromEntries(dependents)).toEqual(loadDependentsFixture("printable-shell-command-5.0.7-5.0.8.json"));
    });
});
//# sourceMappingURL=collectDependents.test.js.map