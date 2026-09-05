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
 * `styleText`'s own stream detection always looks at `process.stdout`, and bun
 * has emitted escape codes regardless of it in the past. The bins run under
 * both runtimes and also report on stderr, so the decision is taken here and
 * `styleText` is called with `validateStream: false`.
 */
export declare const shouldColorize: (stream?: {
    isTTY?: boolean;
}) => boolean;
export declare const createColorize: (enabled: boolean) => Colorize;
export {};
//# sourceMappingURL=reportColors.d.ts.map