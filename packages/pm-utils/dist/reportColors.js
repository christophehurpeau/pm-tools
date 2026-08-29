// Backported to node 22.13, so every version this package supports has it
// except the 23.0-23.4 window the engines range admits only in theory.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { styleText } from "node:util";
// One hue for package identifiers, the scope a shade deeper than the name it
// prefixes. `styleText` only knows the 16 named colours, hence the raw codes.
const palette = {
    scope: { hex: "#d75f00", ansi256: 166 },
    packageName: { hex: "#d7875f", ansi256: 173 },
};
/**
 * `styleText`'s own stream detection is not portable: bun emits escape codes
 * whether or not stdout is a TTY, and ignores the `stream` / `validateStream`
 * options. The bins run under both runtimes, so the decision is taken here.
 */
export const shouldColorize = (stream = process.stdout) => {
    const { FORCE_COLOR, NO_COLOR, TERM } = process.env;
    if (FORCE_COLOR !== undefined && FORCE_COLOR !== "" && FORCE_COLOR !== "0") {
        return true;
    }
    if (NO_COLOR !== undefined && NO_COLOR !== "")
        return false;
    if (TERM === "dumb")
        return false;
    return stream.isTTY === true;
};
const plain = (_styles, text) => text;
const isPaletteStyle = (style) => style in palette;
// 24-bit when the terminal advertises it, the 256-colour approximation
// otherwise.
const paletteCode = (style) => {
    const { hex, ansi256 } = palette[style];
    const { COLORTERM } = process.env;
    if (COLORTERM !== "truecolor" && COLORTERM !== "24bit") {
        return `38;5;${ansi256}`;
    }
    const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
    return `38;2;${channels.join(";")}`;
};
// The palette colour wraps whatever `styleText` produced: its own reset (`22m`
// for bold) leaves the colour standing, where the reverse order would not.
const styled = (styles, text) => {
    const requested = Array.isArray(styles) ? styles : [styles];
    const named = requested.filter((style) => !isPaletteStyle(style));
    const inner = named.length > 0 ? styleText(named, text) : text;
    const paletteStyle = requested.find(isPaletteStyle);
    return paletteStyle === undefined
        ? inner
        : `\u001B[${paletteCode(paletteStyle)}m${inner}\u001B[39m`;
};
export const createColorize = (enabled) => enabled ? styled : plain;
//# sourceMappingURL=reportColors.js.map