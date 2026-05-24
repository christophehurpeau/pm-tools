/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// TODO parse key to extract install path
export const parseBunLockPackages = (bunLockResult) => {
    const packages = new Map();
    const resolvedPackages = new Map();
    Object.entries(bunLockResult.packages).forEach(([key, packageArray]) => {
        packages.set(key, (() => {
            const value = packageArray;
            const resolution = value[0];
            const existingResolved = resolvedPackages.get(resolution);
            if (existingResolved) {
                return existingResolved;
            }
            const { name, rest } = (() => {
                if (resolution.startsWith("@")) {
                    const atPos = resolution.indexOf("@", 1);
                    return {
                        name: resolution.slice(0, atPos),
                        rest: resolution.slice(atPos + 1),
                    };
                }
                else {
                    const atPos = resolution.indexOf("@");
                    return {
                        name: resolution.slice(0, atPos),
                        rest: resolution.slice(atPos + 1),
                    };
                }
            })();
            const bunPackage = (() => {
                if (rest.startsWith("workspace:")) {
                    return {
                        type: "workspace",
                        name,
                        resolution,
                        path: rest.slice("workspace:".length),
                    };
                }
                else if (rest.startsWith("link:")) {
                    return {
                        type: "symlink",
                        name,
                        resolution,
                        path: rest.slice("link:".length),
                        info: value[1],
                    };
                }
                else if (rest.startsWith("file:")) {
                    return {
                        type: "folder",
                        name,
                        resolution,
                        path: rest.slice("file:".length),
                        info: value[1],
                    };
                }
                else if (rest.startsWith("root:")) {
                    return {
                        type: "root",
                        name,
                        resolution,
                        bin: value[1].bin,
                        binDir: value[1].binDir,
                    };
                }
                else if (rest.startsWith("git+")) {
                    return {
                        type: "git",
                        name,
                        resolution,
                        repo: rest.slice("git+".length),
                        info: value[1],
                    };
                }
                else if (rest.startsWith("github:")) {
                    const ghRepo = rest.slice("github:".length);
                    const [user, repo] = ghRepo.split("/");
                    if (!user) {
                        throw new Error(`Unexpected github resolution: ${resolution}: could not find user`);
                    }
                    if (!repo) {
                        throw new Error(`Unexpected github resolution: ${resolution}: could not find repo`);
                    }
                    return {
                        type: "github",
                        name,
                        resolution,
                        user,
                        repo,
                        info: value[1],
                    };
                }
                else if (rest.startsWith("http://") ||
                    rest.startsWith("https://")) {
                    return {
                        type: "tarball",
                        name,
                        resolution,
                        tarball: rest,
                        info: value[1],
                    };
                }
                else {
                    return {
                        type: "npm",
                        name,
                        resolution,
                        version: rest,
                        registry: value[1],
                        info: value[2],
                        integrity: value[3],
                    };
                }
            })();
            resolvedPackages.set(resolution, bunPackage);
            return bunPackage;
        })());
    });
    return packages;
};
//# sourceMappingURL=parseBunLockPackages.js.map