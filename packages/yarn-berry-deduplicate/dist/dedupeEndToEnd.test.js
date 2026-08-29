import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildYarnPackagesMap } from "./helpers/buildYarnPackagesMap.js";
import { fixtureDir } from "./helpers/fixtures.js";
import { parseYarnLockPackages } from "./helpers/parseYarnLockPackages.js";
import { createTempProjects } from "./helpers/tempProjects.js";
import { readAndParseYarnLock } from "./readYarnLock.js";
// The shipped tool against a real yarn berry: a copy of the `e2e-stale-range`
// fixture, a real `yarn install`, then the built `yarn-berry-deduplicate` bin as
// a user would run it and the `yarn install` it asks for. Every other test stubs
// the resolution step, so this is the only one that can tell whether yarn holds
// the merged version — nothing left pinning it, no resolution in the manifest,
// only the rewritten lockfile — and yarn is asked for its own account of the
// installed tree at the end rather than only our reading of it.
//
// Run once per `nodeLinker`. The tool never looks at an installed tree — it
// reads `yarn.lock` and the workspace manifests, and yarn resolves before it
// links, so the lockfile it rewrites is the same file under either linker. What
// the pnp run adds is the other half: that yarn accepts the rewritten lockfile
// and links a runtime map from it with no `node_modules` to fall back on, which
// is the default a berry user is actually standing in.
//
// Requires network access or a warm yarn cache. The fixture pins
// `packageManager`, so corepack answers with berry rather than the yarn 1.x a
// bare `yarn` resolves to in a project that pins nothing.
// probed inside the fixture, not the repo: corepack answers with whatever the
// project pins, and only the fixture pins berry
const yarnAvailable = (() => {
    const result = spawnSync("yarn", ["--version"], {
        cwd: fixtureDir("e2e-stale-range"),
        encoding: "utf8",
    });
    return result.status === 0 && !result.stdout.trim().startsWith("1.");
})();
const suite = yarnAvailable ? describe : describe.skip;
// the built bin, the one the `bin` field points at: from `src` it is one level
// up, and the compiled copy of this file sits beside it
const dedupeBin = (() => {
    const built = [
        "../dist/bin/yarn-berry-deduplicate.js",
        "./bin/yarn-berry-deduplicate.js",
    ]
        .map((binPath) => fileURLToPath(new URL(binPath, import.meta.url)))
        .find((binPath) => existsSync(binPath));
    if (!built) {
        throw new Error("yarn-berry-deduplicate is not built: run `bun run build` first");
    }
    return built;
})();
const projects = createTempProjects("yarn-berry-deduplicate-e2e-");
afterEach(projects.cleanup);
const run = (cwd, command, args) => {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        timeout: 300_000,
    });
    if (result.error)
        throw result.error;
    return {
        status: result.status,
        output: `${result.stdout}\n${result.stderr}`,
    };
};
const install = (cwd, ...args) => run(cwd, "yarn", ["install", ...args]);
const dedupe = (cwd, ...args) => run(cwd, process.execPath, [dedupeBin, ...args]);
const resolutionsOf = (dir, packageName) => {
    const packagesMap = buildYarnPackagesMap(parseYarnLockPackages(readAndParseYarnLock(join(dir, "yarn.lock"))));
    return (packagesMap[packageName] ?? []).map(({ resolution }) => resolution);
};
// The fixture pins a linker so its own `yarn install` is reproducible; each run
// rewrites just that line, leaving the rest of the file alone.
const setNodeLinker = (dir, nodeLinker) => {
    const path = join(dir, ".yarnrc.yml");
    const yarnrc = readFileSync(path, "utf8");
    const updated = yarnrc.replace(/^nodeLinker:.*$/mu, `nodeLinker: ${nodeLinker}`);
    if (updated === yarnrc && !yarnrc.includes(`nodeLinker: ${nodeLinker}`)) {
        throw new Error(`${path} declares no nodeLinker to override`);
    }
    writeFileSync(path, updated);
};
/**
 * The versions the linker left for the runtime to resolve, read off the
 * artefact it wrote. Neither artefact answers for the other: pnp writes no
 * `node_modules` at all, and going through `require` instead is refused by
 * `printable-shell-command`'s own `exports`, which does not expose
 * `./package.json`.
 */
const linkedVersions = (dir, packageName, nodeLinker) => {
    if (nodeLinker === "node-modules") {
        const manifest = JSON.parse(readFileSync(join(dir, "node_modules", packageName, "package.json"), "utf8"));
        return [manifest.version];
    }
    // Every copy `.pnp.cjs` can reach is a cache archive, named
    // `<name>-npm-<version>-<hash>-<cacheKey>.zip`. `packageName` is interpolated
    // raw: the one package this test names carries no regex metacharacter.
    const pattern = new RegExp(`${packageName}-npm-(?<version>.+?)-[0-9a-f]{10}-`, "gu");
    const versions = [
        ...readFileSync(join(dir, ".pnp.cjs"), "utf8").matchAll(pattern),
    ].map((match) => match.groups.version);
    return [...new Set(versions)].toSorted();
};
suite("yarn-berry-deduplicate end to end", () => {
    it.each(["node-modules", "pnp"])("merges the stale range onto the pinned version and leaves yarn installing it (nodeLinker: %s)", (nodeLinker) => {
        const dir = projects.create();
        cpSync(fixtureDir("e2e-stale-range"), dir, { recursive: true });
        setNodeLinker(dir, nodeLinker);
        const manifestsBefore = ["package.json", "packages/a/package.json"].map((path) => readFileSync(join(dir, path), "utf8"));
        const installed = install(dir);
        expect(installed.status).toBe(0);
        // `a` asks for `^5.0.7` and the lockfile still answers 5.0.7, while `b`
        // pins the 5.3.1 that would satisfy them both
        expect(resolutionsOf(dir, "printable-shell-command")).toEqual([
            "printable-shell-command@npm:5.3.1",
            "printable-shell-command@npm:5.0.7",
        ]);
        const check = dedupe(dir, "--check");
        expect(check.status).toBe(1);
        const applied = dedupe(dir);
        expect(applied.status).toBe(0);
        expect(applied.output).toContain("yarn.lock updated");
        // the rewrite only asks; yarn is what applies it
        const reinstalled = install(dir);
        expect(reinstalled.status).toBe(0);
        expect(resolutionsOf(dir, "printable-shell-command")).toEqual([
            "printable-shell-command@npm:5.3.1",
        ]);
        // the same thing again, read from what yarn actually put on disk
        expect(linkedVersions(dir, "printable-shell-command", nodeLinker)).toEqual(["5.3.1"]);
        // nothing was pinned into a manifest to hold it there
        expect(["package.json", "packages/a/package.json"].map((path) => readFileSync(join(dir, path), "utf8"))).toEqual(manifestsBefore);
        // and yarn agrees the lockfile is one CI could install from as it stands
        expect(install(dir, "--immutable").status).toBe(0);
        expect(dedupe(dir, "--check").status).toBe(0);
    }, 300_000);
});
//# sourceMappingURL=dedupeEndToEnd.test.js.map