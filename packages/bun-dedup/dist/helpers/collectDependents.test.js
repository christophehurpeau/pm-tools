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
    it("resolves the version a nested requester actually got", () => {
        const bunLock = readAndParseBunLock(fixturesBase("../../test/fixtures/duplicated-typescript-eslint/bun.lock"));
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces, [
            "semver",
        ]);
        const byRequester = new Map((dependents.get("semver") ?? []).map((dependent) => [
            dependent.key,
            dependent.resolvedVersion,
        ]));
        // `eslint-plugin-react` has its own nested copy; the others share the
        // top-level one
        expect(byRequester.get("eslint-plugin-react")).toBe("6.3.1");
        expect(byRequester.get("eslint-plugin-n")).toBe("7.8.4");
    });
    // `exact-pin-forces-downgrade`: `@yudiel/react-qr-scanner` pins
    // barcode-detector at exactly 3.0.3 while `expo-camera` declares `^3.0.0` and
    // got 3.2.2. bun.lock stores both the range and the resolution, so the report
    // never has to guess which is which.
    it("keeps a caret range apart from the version it resolved to", () => {
        const bunLock = readAndParseBunLock(fixturesBase("../../test/fixtures/exact-pin-forces-downgrade/bun.lock"));
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces, [
            "barcode-detector",
        ]);
        expect((dependents.get("barcode-detector") ?? []).map((dependent) => [
            dependent.key,
            dependent.version,
            dependent.resolvedVersion,
        ])).toEqual([
            ["@yudiel/react-qr-scanner", "3.0.3", "3.0.3"],
            ["expo-camera", "^3.0.0", "3.2.2"],
        ]);
    });
    // `aliased-nested`: `plugin` declares `"semver-legacy": "npm:semver@^6.0.0"`,
    // so the lockfile nests it under the alias — the path segment is the declared
    // key, never the resolved name.
    it("resolves through aliased path segments", () => {
        const bunLock = readAndParseBunLock(fixturesBase("../../test/fixtures/aliased-nested/bun.lock"));
        const packages = parseBunLockPackages(bunLock);
        const dependents = collectDependents(packages, bunLock.workspaces, [
            "semver",
            "helper",
        ]);
        const resolvedBy = (packageName) => new Map((dependents.get(packageName) ?? []).map((dependent) => [
            dependent.key,
            dependent.resolvedVersion,
        ]));
        // the alias, not the top-level 7.8.1 `other` got
        expect(resolvedBy("semver").get("plugin")).toBe("6.3.1");
        expect(resolvedBy("semver").get("other")).toBe("7.8.1");
        // walking up out of `plugin/semver-legacy` has to reach `plugin/helper`,
        // not fall through to the top-level 2.0.0
        expect(resolvedBy("helper").get("plugin/semver-legacy")).toBe("1.5.0");
        expect(resolvedBy("helper").get("plugin")).toBe("1.5.0");
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