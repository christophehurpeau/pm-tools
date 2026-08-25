// Backported to node 22.13, so every version this package supports has it
// except the 23.0-23.4 window the engines range admits only in theory.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { styleText } from "node:util";

export type ReportStyle = "bold" | "cyan" | "dim" | "green" | "red" | "yellow";

export type Colorize = (
  styles: ReportStyle | ReportStyle[],
  text: string,
) => string;

/**
 * `styleText`'s own stream detection is not portable: bun emits escape codes
 * whether or not stdout is a TTY, and ignores the `stream` / `validateStream`
 * options. The bins run under both runtimes, so the decision is taken here.
 */
export const shouldColorize = (
  stream: { isTTY?: boolean } = process.stdout,
): boolean => {
  const { FORCE_COLOR, NO_COLOR, TERM } = process.env;
  if (FORCE_COLOR !== undefined && FORCE_COLOR !== "" && FORCE_COLOR !== "0") {
    return true;
  }
  if (NO_COLOR !== undefined && NO_COLOR !== "") return false;
  if (TERM === "dumb") return false;
  return stream.isTTY === true;
};

const plain: Colorize = (_styles, text) => text;

export const createColorize = (enabled: boolean): Colorize =>
  enabled ? (styles, text) => styleText(styles, text) : plain;
