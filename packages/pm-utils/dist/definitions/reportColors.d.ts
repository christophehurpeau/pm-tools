export type ReportStyle = "bold" | "cyan" | "dim" | "green" | "red" | "yellow";
export type Colorize = (styles: ReportStyle | ReportStyle[], text: string) => string;
/**
 * `styleText`'s own stream detection is not portable: bun emits escape codes
 * whether or not stdout is a TTY, and ignores the `stream` / `validateStream`
 * options. The bins run under both runtimes, so the decision is taken here.
 */
export declare const shouldColorize: (stream?: {
    isTTY?: boolean;
}) => boolean;
export declare const createColorize: (enabled: boolean) => Colorize;
//# sourceMappingURL=reportColors.d.ts.map