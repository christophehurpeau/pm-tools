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

const quoted = (value: string): Scalar<string> => {
  const scalar = new Scalar(value);
  scalar.type = Scalar.QUOTE_DOUBLE;
  return scalar;
};

export interface AddOverridesOptions {
  // false writes plain keys, which pnpm applies to every requester
  convergence?: boolean;
}

/**
 * Add overrides to a `pnpm-workspace.yaml`, editing the document rather than
 * reserializing it: the user's comments, key order and formatting have to
 * survive. Pass `undefined` for a file that does not exist yet.
 */
export const addOverrides = (
  content: string | undefined,
  overrides: Map<string, string>,
  { convergence = true }: AddOverridesOptions = {},
): string => {
  const doc = parseDocument(content ?? "");

  for (const [packageName, version] of overrides) {
    doc.setIn(
      ["overrides", quoted(overrideKey(packageName, convergence))],
      quoted(version),
    );
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
