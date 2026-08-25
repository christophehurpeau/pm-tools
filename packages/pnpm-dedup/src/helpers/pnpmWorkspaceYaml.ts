import { Scalar, parseDocument } from "yaml";

/**
 * A convergence override (pnpm >= 11.13.0) is an override key with an empty
 * range selector. It repoints a dependency edge only when the edge's declared
 * range accepts the exact version, so the members a third-party range
 * legitimately pins elsewhere keep their own resolution instead of being forced.
 * The plain key is the unconditional one: every requester gets the version.
 */
export const overrideKey = (
  packageName: string,
  convergence: boolean,
): string => (convergence ? `${packageName}@` : packageName);

// `yaml` writes `commentBefore` straight after the `#`, so the leading space
// that makes it read as prose has to be part of every line.
const spaced = (comment: string): string =>
  comment
    .split("\n")
    .map((line) => (line.startsWith(" ") ? line : ` ${line}`))
    .join("\n");

const quoted = (value: string): Scalar<string> => {
  const scalar = new Scalar(value);
  scalar.type = Scalar.QUOTE_DOUBLE;
  return scalar;
};

export interface AddOverridesOptions {
  // false writes plain keys, which pnpm applies to every requester
  convergence?: boolean;
  comment?: string;
}

/**
 * Add overrides to a `pnpm-workspace.yaml`, editing the document rather than
 * reserializing it: the user's comments, key order and formatting have to
 * survive. Pass `undefined` for a file that does not exist yet.
 *
 * `comment` is attached above the first entry added, not above the `overrides`
 * key, so an existing block and whatever the user wrote about it stay untouched.
 */
export const addOverrides = (
  content: string | undefined,
  overrides: Map<string, string>,
  { convergence = true, comment }: AddOverridesOptions = {},
): string => {
  const doc = parseDocument(content ?? "");
  let isFirst = true;

  for (const [packageName, version] of overrides) {
    const key = quoted(overrideKey(packageName, convergence));
    if (isFirst && comment !== undefined) {
      key.commentBefore = spaced(comment);
    }
    doc.setIn(["overrides", key], quoted(version));
    isFirst = false;
  }

  return doc.toString();
};

export const readConvergenceOverrides = (
  content: string,
): Map<string, string> => {
  const parsed = parseDocument(content).toJS() as {
    overrides?: Record<string, unknown>;
  } | null;

  return new Map(
    Object.entries(parsed?.overrides ?? {}).flatMap(([key, value]) =>
      key.endsWith("@") && typeof value === "string"
        ? [[key.slice(0, -1), value] as [string, string]]
        : [],
    ),
  );
};
