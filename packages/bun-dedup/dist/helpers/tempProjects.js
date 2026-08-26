import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Scratch projects for the tests that need a real directory on disk. The
// end-to-end ones run an actual install in theirs, so a leaked directory is
// tens of megabytes.
//
// `afterEach` covers the normal path — a passing, failing or timed-out test all
// reach it — but not a signal: on Ctrl-C the test runner exits without running
// the remaining hooks, and on SIGKILL nothing runs at all. So cleanup does not
// rest on it alone:
//   - the directory name carries the pid that owns it, and every run first
//     reaps the leftovers of pids that are gone,
//   - SIGINT/SIGTERM clean up before the signal is allowed through.
const isRunning = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        // EPERM: alive, but owned by another user — not ours to reap either way
        return error.code === "EPERM";
    }
};
const remove = (dir) => {
    try {
        rmSync(dir, { recursive: true, force: true });
    }
    catch {
        // a directory a still-running install is writing into can fail to unlink;
        // the next run reaps it once that pid is gone
    }
};
// the `${pid}-${mkdtemp suffix}` a `create` call leaves after the prefix. Names
// that do not match are left alone: a random suffix read as a pid would reap
// directories this helper never made.
const ownerPidPattern = /^(?<pid>[1-9]\d*)-/u;
const reapAbandoned = (prefix) => {
    const root = tmpdir();
    for (const name of readdirSync(root)) {
        if (!name.startsWith(prefix))
            continue;
        const owner = ownerPidPattern.exec(name.slice(prefix.length))?.groups?.pid;
        if (!owner || isRunning(Number(owner)))
            continue;
        remove(join(root, name));
    }
};
const pendingCleanups = new Set();
let signalsHooked = false;
const hookSignals = () => {
    if (signalsHooked)
        return;
    signalsHooked = true;
    for (const signal of ["SIGINT", "SIGTERM"]) {
        const handler = () => {
            for (const cleanup of pendingCleanups)
                cleanup();
            // a listener suppresses the default termination: drop it and re-raise so
            // the process still dies of the signal it was sent
            process.removeListener(signal, handler);
            process.kill(process.pid, signal);
        };
        process.on(signal, handler);
    }
};
export const createTempProjects = (prefix) => {
    reapAbandoned(prefix);
    hookSignals();
    const dirs = [];
    const cleanup = () => {
        for (const dir of dirs.splice(0))
            remove(dir);
    };
    pendingCleanups.add(cleanup);
    return {
        create: () => {
            const dir = mkdtempSync(join(tmpdir(), `${prefix}${process.pid}-`));
            dirs.push(dir);
            return dir;
        },
        cleanup,
    };
};
//# sourceMappingURL=tempProjects.js.map