import { describe, it } from "bun:test";
import { strictEqual } from "node:assert/strict";
import { clusterLabel } from "./clusterLabel.js";
const typescriptEslint = [
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "@typescript-eslint/project-service",
    "@typescript-eslint/scope-manager",
    "@typescript-eslint/tsconfig-utils",
    "@typescript-eslint/type-utils",
    "@typescript-eslint/types",
    "@typescript-eslint/typescript-estree",
    "@typescript-eslint/utils",
    "@typescript-eslint/visitor-keys",
    "typescript-eslint",
];
const metroFamily = [
    "@react-native/asset-utils",
    "@react-native/babel-plugin-codegen",
    "@react-native/babel-preset",
    "@react-native/codegen",
    "metro",
    "metro-cache",
    "metro-config",
    "metro-core",
    "ob1",
    "react-native",
];
describe("clusterLabel", () => {
    it("names a family by its shared scope", () => {
        strictEqual(clusterLabel(typescriptEslint), "@typescript-eslint/* (+1 more)");
    });
    it("names the two largest groups and counts the rest", () => {
        strictEqual(clusterLabel(metroFamily), "@react-native/* + metro* (+2 more)");
    });
    it("uses a dash prefix when no member carries the prefix itself", () => {
        strictEqual(clusterLabel([
            "babel-plugin-syntax-hermes-parser",
            "hermes-estree",
            "hermes-parser",
        ]), "hermes-* (+1 more)");
    });
    it("keeps the member name when it is the prefix", () => {
        strictEqual(clusterLabel(["mini-metro", "mini-metro-config"]), "mini-metro*");
    });
    it("names a single member exactly", () => {
        strictEqual(clusterLabel(["metro"]), "metro");
    });
    it("does not name a second group that covers one member", () => {
        strictEqual(clusterLabel(["metro", "metro-config", "ob1"]), "metro* (+1 more)");
    });
    it("returns an empty label for no members", () => {
        strictEqual(clusterLabel([]), "");
    });
});
//# sourceMappingURL=clusterLabel.test.js.map