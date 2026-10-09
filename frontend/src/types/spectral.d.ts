/*
 * spectral.js ships as an untyped UMD bundle, so this is the contract the site
 * is allowed to use. Only the members the paint lab reaches for are declared:
 * widening this file, rather than sprinkling `any`, is what keeps a library
 * upgrade from breaking the build quietly.
 */

declare module "spectral.js" {
  export class Color {
    /**
     * One CSS string, or one array: 38 numbers read as a reflectance curve,
     * anything shorter as an sRGB triplet.
     */
    constructor(...args: [string] | [number[]]);
    /** sRGB triplet in 0..255, kept ungamut-mapped so out-of-gamut reads are visible. */
    sRGB: number[];
    /** Linear RGB, the values `inGamut` checks against 0..1. */
    lRGB: number[];
    /** Spectral reflectance curve, 38 samples. */
    R: number[];
    /** CIE XYZ tristimulus. */
    XYZ: number[];
    readonly OKLab: number[];
    readonly OKLCh: number[];
    readonly KS: number[];
    readonly luminance: number;
    tintingStrength: number;
    inGamut(options?: { epsilon?: number }): boolean;
    toGamut(options?: { method?: "clip" | "map" }): Color;
    toString(options?: { format?: "hex" | "rgb"; method?: "clip" | "map" }): string;
  }

  export function mix(...entries: [Color, number][]): Color;

  export function palette(a: Color, b: Color, size: number): Color[];

  export function gradient(t: number, ...stops: [Color, number][]): Color;
}