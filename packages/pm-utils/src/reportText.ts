/**
 * The wording every report shares. Kept in one place so `why-duplicate` and the
 * summary of a dedupe run cannot drift on how they count versions: both mean
 * "this many remain", never "this many were merged".
 */

export const plural = (
  count: number,
  singular: string,
  pluralForm: string,
): string => `${count} ${count === 1 ? singular : pluralForm}`;

/**
 * How wide a left column may get before it starts pushing what follows off the
 * right of the screen. A value longer than the budget keeps its own line width
 * — the column is sized on the longest one that fits, so the outlier overflows
 * alone instead of clamping the column below what every other row needs.
 */
export const maxColumnWidth = 44;

// Beyond this a census stops being readable and the tail is counted instead.
export const maxItemsListed = 5;

export const columnWidth = (
  values: string[],
  budget: number = maxColumnWidth,
): number =>
  Math.max(
    0,
    ...values.map((value) => value.length).filter((length) => length <= budget),
  );

// padded on the plain value: the styled one carries escape codes
export const padTo = (width: number, value: string): string =>
  " ".repeat(Math.max(0, width - value.length));

interface ListTextOptions {
  items: string[];
  render?: (item: string) => string;
  limit?: number;
  more: (rest: number) => string;
}

/**
 * `a, b, c, +2 more` — the tail counted rather than dropped, so a truncated
 * list never reads as a complete one.
 */
export const listText = ({
  items,
  render = (item) => item,
  limit = maxItemsListed,
  more,
}: ListTextOptions): string => {
  const listed = items.slice(0, limit);
  const rest = items.length - listed.length;
  const suffix = rest === 0 ? "" : more(rest);
  return `${listed.map(render).join(", ")}${suffix}`;
};
