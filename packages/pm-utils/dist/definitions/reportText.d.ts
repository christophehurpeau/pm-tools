/**
 * The wording every report shares. Kept in one place so `why-duplicate` and the
 * summary of a dedupe run cannot drift on how they count versions: both mean
 * "this many remain", never "this many were merged".
 */
export declare const plural: (count: number, singular: string, pluralForm: string) => string;
/**
 * How wide a left column may get before it starts pushing what follows off the
 * right of the screen. A value longer than the budget keeps its own line width
 * — the column is sized on the longest one that fits, so the outlier overflows
 * alone instead of clamping the column below what every other row needs.
 */
export declare const maxColumnWidth = 44;
export declare const maxItemsListed = 5;
export declare const columnWidth: (values: string[], budget?: number) => number;
export declare const padTo: (width: number, value: string) => string;
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
export declare const listText: ({ items, render, limit, more, }: ListTextOptions) => string;
export {};
//# sourceMappingURL=reportText.d.ts.map