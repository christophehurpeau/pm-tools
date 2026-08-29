declare const palette: {
    readonly scope: {
        readonly hex: "#d75f00";
        readonly ansi256: 166;
    };
    readonly packageName: {
        readonly hex: "#d7875f";
        readonly ansi256: 173;
    };
};
export type PaletteStyle = keyof typeof palette;
export type ReportStyle = PaletteStyle | "bold" | "cyan" | "dim" | "green" | "red" | "yellow";
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
export {};
//# sourceMappingURL=reportColors.d.ts.map