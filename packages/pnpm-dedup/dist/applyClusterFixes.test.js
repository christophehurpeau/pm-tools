import { afterEach, describe, it } from "bun:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyClusterFixes } from "./applyClusterFixes.js";
const fix = (overrides) => ({
    members: [],
    duplicatedMembers: [],
    memberVersions: {},
    target: null,
    direction: "none",
    convergentMembers: [],
    driverMembers: [],
    excludedMembers: [],
    anchor: null,
    reuseFixes: [],
    floatingMembers: [],
    workspaceChanges: [],
    reResolutionSet: [],
    externalConstraints: [],
    needsRoundTrip: false,
    applicable: false,
    ...overrides,
});
const manifestContent = [
    "{",
    '  "name": "root",',
    '  "devDependencies": {',
    '    "metro": "0.84.5"',
    "  }",
    "}",
    "",
].join("\n");
const workspaceYamlContent = "# keep me\nresolutionMode: time-based\n";
const projects = [];
const makeProject = (files) => {
    const dir = mkdtempSync(join(tmpdir(), "pnpm-dedup-apply-"));
    projects.push(dir);
    for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(dir, name), content);
    }
    return dir;
};
afterEach(() => {
    for (const dir of projects.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});
const read = (dir, name) => readFileSync(join(dir, name), "utf8");
const snapshot = (...resolutions) => new Set(resolutions);
describe("applyClusterFixes", () => {
    const metroFix = fix({
        applicable: true,
        target: "0.87.0",
        convergentMembers: ["metro-config"],
        workspaceChanges: [
            {
                requester: "package.json in devDependencies",
                requesterName: undefined,
                packageName: "metro",
                range: "0.84.5",
                to: "0.87.0",
                workspace: { path: ".", depType: "devDependencies" },
            },
        ],
    });
    it("keeps the workspace edit and never writes an override when it is enough", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
            "pnpm-workspace.yaml": workspaceYamlContent,
        });
        let duplicates = snapshot("metro-config@0.84.5", "metro-config@0.87.0");
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: () => undefined,
            pnpmVersion: () => "11.17.0",
            readFixes: () => [metroFix],
            readDuplicates: () => duplicates,
            resolve: () => {
                // pnpm's part: with the pin widened, the 0.84.5 subtree has no reason
                // to exist any more
                if (read(dir, "package.json").includes('"metro": "0.87.0"')) {
                    duplicates = snapshot();
                }
                return 0;
            },
        });
        strictEqual(outcome.status, "applied");
        strictEqual(outcome.after.size, 0);
        ok(read(dir, "package.json").includes('"metro": "0.87.0"'));
        strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
    });
    const leafFix = fix({
        applicable: true,
        target: "2.0.0",
        convergentMembers: ["leaf"],
    });
    it("removes the overrides again once pnpm holds the result on its own", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
            "pnpm-workspace.yaml": workspaceYamlContent,
        });
        let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");
        let converged = false;
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.13.0",
            readFixes: () => [leafFix],
            readDuplicates: () => duplicates,
            resolve: () => {
                if (read(dir, "pnpm-workspace.yaml").includes('"leaf@"')) {
                    converged = true;
                }
                // sticky: pnpm keeps a locked resolution that still satisfies the range
                duplicates = converged ? snapshot() : duplicates;
                return 0;
            },
        });
        strictEqual(outcome.status, "applied");
        deepStrictEqual(outcome.stickyOverrides, []);
        strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
        ok(logs.some((line) => line.includes("Removing the overrides")));
    });
    it("keeps the overrides, explaining why in the file and in the result", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
            "pnpm-workspace.yaml": workspaceYamlContent,
        });
        const duplicated = snapshot("leaf@1.0.0", "leaf@2.0.0");
        let duplicates = duplicated;
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.17.0",
            readFixes: () => [leafFix],
            readDuplicates: () => duplicates,
            resolve: () => {
                // the duplicate only stays away while the override is there
                duplicates = read(dir, "pnpm-workspace.yaml").includes('"leaf@"')
                    ? snapshot()
                    : duplicated;
                return 0;
            },
        });
        strictEqual(outcome.status, "kept-overrides");
        deepStrictEqual(outcome.stickyOverrides.map((override) => override.packageName), ["leaf"]);
        const workspaceYaml = read(dir, "pnpm-workspace.yaml");
        ok(workspaceYaml.includes('"leaf@": "2.0.0"'));
        ok(workspaceYaml.includes("# Added by pnpm-dedup."));
        ok(workspaceYaml.includes("# handled without a standing override: https://github.com"));
        // the user's own content survives the write
        ok(workspaceYaml.includes("# keep me"));
        ok(workspaceYaml.includes("resolutionMode: time-based"));
        ok(logs.some((line) => line.includes("github.com/christophehurpeau")));
        ok(logs.some((line) => line.includes("Kept in")));
    });
    it("writes plain overrides and skips the version gate when convergence is disabled", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
            "pnpm-workspace.yaml": workspaceYamlContent,
        });
        let duplicates = snapshot("leaf@1.0.0", "leaf@2.0.0");
        let plainKeyWritten = false;
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: () => undefined,
            convergenceOverrides: false,
            // a pnpm too old for convergence overrides still writes plain ones
            pnpmVersion: () => "11.12.0",
            readFixes: () => [leafFix],
            readDuplicates: () => duplicates,
            resolve: () => {
                if (read(dir, "pnpm-workspace.yaml").includes('"leaf": "2.0.0"')) {
                    plainKeyWritten = true;
                    duplicates = snapshot();
                }
                return 0;
            },
        });
        strictEqual(outcome.status, "applied");
        ok(plainKeyWritten);
        strictEqual(read(dir, "pnpm-workspace.yaml"), workspaceYamlContent);
    });
    // a plain override has no range condition, so one the detector proposed from
    // a single requester's range cannot be written when another rejects it
    it("drops a plain override a third-party range rejects", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: (message = "") => logs.push(message),
            convergenceOverrides: false,
            pnpmVersion: () => "11.17.0",
            readFixes: () => [
                fix({
                    anchor: "0.84.5",
                    reuseFixes: [
                        {
                            requester: "@tamagui/metro-plugin@1.0.0",
                            requesterName: "@tamagui/metro-plugin",
                            packageName: "metro-config",
                            range: "*",
                            from: "0.87.0",
                            to: "0.84.5",
                        },
                    ],
                    externalConstraints: [
                        {
                            requester: "@react-native/community-cli-plugin@0.87.0",
                            requesterName: "@react-native/community-cli-plugin",
                            packageName: "metro-config",
                            range: "^0.87.0",
                        },
                    ],
                }),
            ],
            readDuplicates: () => snapshot("metro-config@0.84.5"),
            resolve: () => {
                throw new Error("a dropped override must not resolve");
            },
        });
        strictEqual(outcome.status, "nothing-to-do");
        ok(logs.some((line) => line.includes("Skipped override")));
    });
    it("reverts everything when the re-resolution fails", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: () => undefined,
            pnpmVersion: () => "11.17.0",
            readFixes: () => [metroFix],
            readDuplicates: () => snapshot("metro-config@0.84.5", "metro-config@0.87.0"),
            resolve: () => 1,
        });
        strictEqual(outcome.status, "reverted");
        strictEqual(read(dir, "package.json"), manifestContent);
        strictEqual(existsSync(join(dir, "pnpm-workspace.yaml")), false);
    });
    it("writes nothing on a dry run", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            dryRun: true,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.17.0",
            readFixes: () => [metroFix],
            readDuplicates: () => snapshot("metro-config@0.84.5"),
            resolve: () => {
                throw new Error("a dry run must not resolve");
            },
        });
        strictEqual(outcome.status, "dry-run");
        strictEqual(read(dir, "package.json"), manifestContent);
        ok(logs.some((line) => line.includes('"0.84.5" -> "0.87.0"')));
        ok(logs.some((line) => line.startsWith("Would apply:")));
        ok(outcome.plannedChangeCount > 0);
    });
    it("renders repo-relative paths and the transient override file", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        applyClusterFixes({
            projectDir: dir,
            color: false,
            dryRun: true,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.17.0",
            readFixes: () => [metroFix],
            readDuplicates: () => snapshot("metro-config@0.84.5"),
            resolve: () => {
                throw new Error("a dry run must not resolve");
            },
        });
        const output = logs.join("\n");
        ok(output.includes("package.json:"));
        // never the absolute temp path
        ok(!output.includes(dir));
        ok(output.includes("pnpm-workspace.yaml (transient, removed once the result is verified):"));
        ok(output.includes("Run `pnpm-dedupe` to apply."));
    });
    it("names what `pnpm dedupe` itself would still change", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        applyClusterFixes({
            projectDir: dir,
            color: false,
            dryRun: true,
            packageManagerResiduals: "`pnpm dedupe` would also change the lockfile.",
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.17.0",
            readFixes: () => [metroFix],
            readDuplicates: () => snapshot("metro-config@0.84.5"),
            resolve: () => {
                throw new Error("a dry run must not resolve");
            },
        });
        ok(logs.includes("`pnpm dedupe` would also change the lockfile."));
    });
    it("reports nothing to dedupe on a dry run with an empty plan", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            dryRun: true,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.17.0",
            readFixes: () => [],
            readDuplicates: () => snapshot(),
            resolve: () => {
                throw new Error("a dry run must not resolve");
            },
        });
        strictEqual(outcome.status, "dry-run");
        strictEqual(outcome.plannedChangeCount, 0);
        ok(logs.includes("Nothing to dedupe."));
    });
    it("plans nothing on a dry run when pnpm cannot apply it", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            dryRun: true,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "9.0.0",
            readFixes: () => [metroFix],
            readDuplicates: () => snapshot("metro-config@0.84.5"),
            resolve: () => {
                throw new Error("a dry run must not resolve");
            },
        });
        // nothing is applicable, so `--check` has nothing to fail on
        strictEqual(outcome.plannedChangeCount, 0);
        ok(logs.some((line) => line.includes("Cluster fixes need pnpm >=")));
        ok(logs.includes("Nothing to dedupe."));
    });
    it("does nothing on a pnpm without convergence overrides", () => {
        const dir = makeProject({
            "package.json": manifestContent,
            "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        });
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: dir,
            color: false,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.12.0",
            readFixes: () => [metroFix],
            readDuplicates: () => snapshot("metro-config@0.84.5"),
            resolve: () => {
                throw new Error("an unsupported pnpm must not resolve");
            },
        });
        strictEqual(outcome.status, "not-supported");
        strictEqual(read(dir, "package.json"), manifestContent);
        ok(logs.some((line) => line.includes("11.13.0")));
    });
    // End to end from the committed fixture: the detector, the plan and the file
    // the override would land in, with nothing stubbed but the pnpm version.
    it("plans a convergence override for a lone duplicate", () => {
        const logs = [];
        const outcome = applyClusterFixes({
            projectDir: fileURLToPath(new URL("../test/fixtures/exact-pin-forces-downgrade", import.meta.url)),
            dryRun: true,
            log: (message = "") => logs.push(message),
            pnpmVersion: () => "11.17.0",
            resolve: () => {
                throw new Error("a dry run must not resolve");
            },
        });
        strictEqual(outcome.status, "dry-run");
        strictEqual(outcome.plannedChangeCount, 1);
        ok(logs.some((line) => line.includes("pnpm-workspace.yaml")));
        ok(logs.some((line) => line.includes('"barcode-detector@": "3.0.3" (converge)')));
        // zxing-wasm has no covering version, so nothing is planned for it
        ok(!logs.some((line) => line.includes("zxing-wasm")));
    });
    it("reports having nothing to do when no fix is applicable", () => {
        const dir = makeProject({ "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" });
        strictEqual(applyClusterFixes({
            projectDir: dir,
            color: false,
            log: () => undefined,
            pnpmVersion: () => "11.17.0",
            readFixes: () => [fix({ applicable: false })],
            readDuplicates: () => snapshot("leaf@1.0.0"),
            resolve: () => {
                throw new Error("nothing to apply must not resolve");
            },
        }).status, "nothing-to-do");
    });
});
//# sourceMappingURL=applyClusterFixes.test.js.map