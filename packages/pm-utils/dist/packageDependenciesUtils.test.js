import { describe, expect, it } from "bun:test";
import { PackageDependencyDescriptorUtils, isNpmProtocol, isSemverComparable, } from "./packageDependenciesUtils.js";
const npmCases = [
    [
        ["name", "1.1.1"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "1.1.1",
        },
    ],
    [
        ["name", "^1.0.0"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "^1.0.0",
        },
    ],
    [
        ["name", "1.0.0 - 2.0.0"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "1.0.0 - 2.0.0",
        },
    ],
    [
        ["name", ">=1"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: ">=1",
        },
    ],
    [
        ["name", "*"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "*",
        },
    ],
    [
        ["name", ""],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "",
        },
    ],
    [
        ["@scope/name", "^1.0.0"],
        {
            key: "@scope/name",
            npmName: "@scope/name",
            nameDescriptor: { scope: "scope", name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "^1.0.0",
        },
    ],
    // yarn's spelling: `npm:` as a plain protocol on a range, not an alias
    [
        ["name", "npm:^1.0.0"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "npm",
            isAlias: false,
            selector: "^1.0.0",
        },
    ],
    [
        ["name", "npm:*"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "npm",
            isAlias: false,
            selector: "*",
        },
    ],
];
const aliasCases = [
    [
        ["name3", "npm:name@1.1.1"],
        {
            key: "name3",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "npm",
            isAlias: true,
            selector: "1.1.1",
        },
    ],
    [
        ["name2", "npm:@scope/name@1.1.1"],
        {
            key: "name2",
            npmName: "@scope/name",
            nameDescriptor: { scope: "scope", name: "name" },
            protocol: "npm",
            isAlias: true,
            selector: "1.1.1",
        },
    ],
    [
        ["psc", "npm:printable-shell-command@^5.0.0"],
        {
            key: "psc",
            npmName: "printable-shell-command",
            nameDescriptor: { name: "printable-shell-command" },
            protocol: "npm",
            isAlias: true,
            selector: "^5.0.0",
        },
    ],
    // a version-less alias: bun's own `non-npm` fixture declares this shape
    [
        ["bun-types", "npm:@types/bun"],
        {
            key: "bun-types",
            npmName: "@types/bun",
            nameDescriptor: { scope: "types", name: "bun" },
            protocol: "npm",
            isAlias: true,
            selector: "",
        },
    ],
    [
        ["tag", "npm:latest"],
        {
            key: "tag",
            npmName: "latest",
            nameDescriptor: { name: "latest" },
            protocol: "npm",
            isAlias: true,
            selector: "",
        },
    ],
    // an alias whose key already matches the target: `isAlias` is what keeps the
    // name in the value, since `npmName === key` cannot tell the two apart
    [
        ["semver", "npm:semver@^6.0.0"],
        {
            key: "semver",
            npmName: "semver",
            nameDescriptor: { name: "semver" },
            protocol: "npm",
            isAlias: true,
            selector: "^6.0.0",
        },
    ],
];
const otherProtocolCases = [
    [
        ["name", "workspace:*"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "workspace",
            isAlias: false,
            selector: "*",
        },
    ],
    [
        ["name", "workspace:^1.0.0"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "workspace",
            isAlias: false,
            selector: "^1.0.0",
        },
    ],
    [
        ["name", "file:../local"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "file",
            isAlias: false,
            selector: "../local",
        },
    ],
    [
        ["name", "link:../local"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "link",
            isAlias: false,
            selector: "../local",
        },
    ],
    [
        ["name", "github:user/repo"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "github",
            isAlias: false,
            selector: "user/repo",
        },
    ],
    [
        ["name", "github:user/repo#semver:^1"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "github",
            isAlias: false,
            selector: "user/repo#semver:^1",
        },
    ],
    [
        ["name", "jsr:^1.0.0"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "jsr",
            isAlias: false,
            selector: "^1.0.0",
        },
    ],
    [
        ["name", "catalog:default"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "catalog",
            isAlias: false,
            selector: "default",
        },
    ],
    [
        ["name", "patch:name@npm%3A1.0.0#~/p.patch"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "patch",
            isAlias: false,
            selector: "name@npm%3A1.0.0#~/p.patch",
        },
    ],
    [
        ["name", "portal:../local"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "portal",
            isAlias: false,
            selector: "../local",
        },
    ],
    // a git url keeps its whole prefix so the round trip is byte-exact
    [
        ["name", "git+ssh://git@host/r.git#v1"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "git+ssh",
            isAlias: false,
            selector: "//git@host/r.git#v1",
        },
    ],
    [
        ["name", "git+https://host/r.git"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "git+https",
            isAlias: false,
            selector: "//host/r.git",
        },
    ],
    [
        ["name", "https://registry.npmjs.org/react/-/react-18.2.0.tgz"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "https",
            isAlias: false,
            selector: "//registry.npmjs.org/react/-/react-18.2.0.tgz",
        },
    ],
    // an unrecognised protocol parses rather than throwing, and stays out of npm
    [
        ["name", "someproto:whatever"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "someproto",
            isAlias: false,
            selector: "whatever",
        },
    ],
];
// no protocol-shaped prefix at position 0: `/`, `#`, `@` and `.` all stop the
// match, so these must not acquire a protocol
const shorthandCases = [
    [
        ["name", "user/repo"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "user/repo",
        },
    ],
    [
        ["name", "user/repo#semver:^1"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "user/repo#semver:^1",
        },
    ],
    [
        ["name", "./local/path"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "./local/path",
        },
    ],
    [
        ["name", "git@github.com:moment/moment.git"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "git@github.com:moment/moment.git",
        },
    ],
    [
        ["name", "latest"],
        {
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: undefined,
            isAlias: false,
            selector: "latest",
        },
    ],
];
const allCases = [
    ...npmCases,
    ...aliasCases,
    ...otherProtocolCases,
    ...shorthandCases,
];
const expectParsed = (cases) => {
    for (const [[key, value], expected] of cases) {
        expect(PackageDependencyDescriptorUtils.parse(key, value)).toEqual(expected);
    }
};
describe("PackageDependencyDescriptorUtils.parse", () => {
    it("parses npm ranges", () => {
        expectParsed(npmCases);
    });
    it("parses aliases", () => {
        expectParsed(aliasCases);
    });
    it("parses the other protocols", () => {
        expectParsed(otherProtocolCases);
    });
    it("parses declarations carrying no protocol", () => {
        expectParsed(shorthandCases);
    });
    it("rejects a scoped name without a segment", () => {
        expect(() => PackageDependencyDescriptorUtils.parse("name", "npm:@scope")).toThrow("Invalid package name with scope");
    });
    it("does not read an alias out of a non-npm protocol", () => {
        expect(PackageDependencyDescriptorUtils.parse("name", "workspace:@scope/x@1")).toEqual({
            key: "name",
            npmName: "name",
            nameDescriptor: { name: "name" },
            protocol: "workspace",
            isAlias: false,
            selector: "@scope/x@1",
        });
    });
});
describe("PackageDependencyDescriptorUtils.stringify", () => {
    it("round trips every declaration byte for byte", () => {
        for (const [[key, value]] of allCases) {
            expect(PackageDependencyDescriptorUtils.stringify(PackageDependencyDescriptorUtils.parse(key, value))).toEqual([key, value]);
        }
    });
});
describe("PackageDependencyDescriptorUtils.make", () => {
    const swaps = [
        [["name", "^1.0.0"], "2.0.0", "2.0.0"],
        [["name", "npm:^1.0.0"], "^2.0.0", "npm:^2.0.0"],
        [["name", "workspace:^1.0.0"], "^2.0.0", "workspace:^2.0.0"],
        [
            ["psc", "npm:printable-shell-command@^5.0.0"],
            "^5.3.0",
            "npm:printable-shell-command@^5.3.0",
        ],
        [["semver", "npm:semver@^6.0.0"], "^7.0.0", "npm:semver@^7.0.0"],
        [["bun-types", "npm:@types/bun"], "^1.0.0", "npm:@types/bun@^1.0.0"],
    ];
    it("swaps the selector and keeps the protocol, the key and the alias target", () => {
        for (const [[key, value], selector, expected] of swaps) {
            expect(PackageDependencyDescriptorUtils.stringify(PackageDependencyDescriptorUtils.make(PackageDependencyDescriptorUtils.parse(key, value), selector))).toEqual([key, expected]);
        }
    });
});
describe("isNpmProtocol", () => {
    it("accepts a bare declaration and the npm protocol", () => {
        expect(isNpmProtocol(undefined)).toBe(true);
        expect(isNpmProtocol("npm")).toBe(true);
    });
    it("rejects every other protocol", () => {
        for (const protocol of [
            "workspace",
            "file",
            "link",
            "github",
            "git",
            "git+ssh",
            "https",
            "jsr",
            "catalog",
            "patch",
            "portal",
            "someproto",
            // this parser strips the colon, unlike yarn's `structUtils.parseRange`
            "npm:",
        ]) {
            expect(isNpmProtocol(protocol)).toBe(false);
        }
    });
});
describe("isSemverComparable", () => {
    const comparableOf = (key, value) => isSemverComparable(PackageDependencyDescriptorUtils.parse(key, value));
    it("accepts npm ranges, aliases included", () => {
        for (const value of [
            "^1.0.0",
            "1.x",
            "1.0.0 - 2.0.0",
            ">=1",
            "*",
            "npm:^1.0.0",
            "npm:pkg@^1.0.0",
        ]) {
            expect(comparableOf("name", value)).toBe(true);
        }
    });
    // a version-less alias accepts any version, and `semver` reads an empty range
    // as `*`, so it needs no special case
    it("accepts a version-less alias", () => {
        expect(comparableOf("bun-types", "npm:@types/bun")).toBe(true);
    });
    it("rejects every non-npm protocol", () => {
        for (const value of [
            "workspace:*",
            "workspace:^1.0.0",
            "file:../l",
            "link:../l",
            "jsr:^1.0.0",
            "catalog:default",
            "github:user/repo",
            "git+ssh://git@host/r.git",
            "portal:../l",
            "someproto:x",
        ]) {
            expect(comparableOf("name", value)).toBe(false);
        }
    });
    // the cases a protocol check alone would let through
    it("rejects shorthand declarations that carry no protocol", () => {
        for (const value of [
            "user/repo",
            "user/repo#semver:^1",
            "./local/path",
            "git@github.com:moment/moment.git",
            "https://host/x.tgz",
        ]) {
            expect(comparableOf("name", value)).toBe(false);
        }
    });
    // a dist-tag accepts any version, so dropping it from the dependents is the
    // same answer as counting it satisfied by everything — and far better than
    // `semver.satisfies` reading it as unsatisfiable
    it("rejects dist-tags", () => {
        expect(comparableOf("name", "latest")).toBe(false);
        expect(comparableOf("name", "next")).toBe(false);
    });
});
//# sourceMappingURL=packageDependenciesUtils.test.js.map