/* eslint-disable @typescript-eslint/no-unsafe-call */
import { describe, expect, it } from "bun:test";
import { PackageDependencyDescriptorUtils } from "./packageDependenciesUtils.js";
describe("PackageDependencyDescriptorUtils.parse", () => {
    const tests = [
        [
            ["name", "1.1.1"],
            {
                key: "name",
                nameDescriptor: { name: "name" },
                npmName: "name",
                selector: "1.1.1",
            },
        ],
        [
            ["name2", "npm:@scope/name@1.1.1"],
            {
                key: "name2",
                npmName: "@scope/name",
                nameDescriptor: { scope: "scope", name: "name" },
                selector: "1.1.1",
            },
        ],
        [
            ["name3", "npm:name@1.1.1"],
            {
                key: "name3",
                nameDescriptor: { name: "name" },
                npmName: "name",
                selector: "1.1.1",
            },
        ],
    ];
    for (const [[k, v], expected] of tests) {
        it(`should parse "${k}" to "${v}"`, () => {
            expect(PackageDependencyDescriptorUtils.parse(k, v)).toEqual(expected);
        });
    }
});
//# sourceMappingURL=packageDependenciesUtils.test.js.map