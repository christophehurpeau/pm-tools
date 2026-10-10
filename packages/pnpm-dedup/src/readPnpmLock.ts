import { readFileSync } from "node:fs";
import { parseAllDocuments } from "yaml";
import type { PnpmLockFile } from "./pnpmLockTypes.ts";

const isPackageManagerDocument = (lock: PnpmLockFile): boolean =>
  Object.values(lock.importers ?? {}).some(
    (importer) => importer.packageManagerDependencies !== undefined,
  );

/**
 * A project declaring `devEngines.packageManager` gets a lockfile of two YAML
 * documents from pnpm 12: the first resolves pnpm itself
 * (`packageManagerDependencies`, `@pnpm/exe.*`), the second is the project's.
 * Only the project document is returned — the other one would report pnpm as a
 * dependency of the project.
 */
export const readPnpmLock = (filepath: string): PnpmLockFile => {
  const documents = parseAllDocuments(readFileSync(filepath, "utf8"));
  const locks = documents.map((document) => {
    const [error] = document.errors;
    if (error) throw error;
    return document.toJS() as PnpmLockFile | null;
  });
  const projectLock = locks.findLast(
    (lock) => lock !== null && !isPackageManagerDocument(lock),
  );
  if (!projectLock) {
    throw new Error(`No project lockfile document found in ${filepath}`);
  }
  return projectLock;
};
