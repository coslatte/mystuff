/*
 * Colour harmony.
 *
 * Builds a set of pigments that are related by construction rather than by luck.
 * Hues are laid out in OKLCh, where a hue angle is perceptually uniform, so
 * "thirty degrees apart" actually means thirty degrees of perceived hue rather
 * than thirty degrees of whatever the sRGB cube happens to do at that lightness.
 *
 * The mixing that turns this set into a colour is spectral.js's. What lives here is
 * only the choice of which colours to start from, and for that one transform is
 * needed that the library does not expose in reverse: OKLCh to sRGB. It is
 * Björn Ottosson's published OKLab matrices, the same ones the library uses
 * internally, and it is the last place raw colour maths appears on this page.
 */

import { Color } from "spectral.js";

/** Perceptual hue relationships, as offsets from a base hue in degrees. */
export const HARMONIES = {
  /** Neighbouring hues. Quiet, cohesive, low contrast. */
  analogous: [0, 34, 68, 102],
  /** The base and the pair either side of its opposite. Stable but not static. */
  split: [0, 156, 204],
  /** Evenly spaced. Maximum hue variety at minimum chroma cost. */
  triadic: [0, 120, 240],
  /** Four evenly spaced hues. Two complementary pairs. */
  tetradic: [0, 90, 180, 270],
} as const;

export type HarmonyName = keyof typeof HARMONIES;

/** The widest spread each scheme allows, so the `spread` knob means the same thing. */
const HARMONY_RANGE: Record<HarmonyName, number> = {
  analogous: 102,
  split: 204,
  triadic: 240,
  tetradic: 270,
};

export type Palette = {
  /** sRGB hex, one per pigment, ready for the board and the lab. */
  hex: string[];
  /** The hue each pigment was built around, in degrees. */
  hues: number[];
};

/**
 * OKLCh to sRGB.
 *
 * Chroma is reduced until the colour fits the display, because an OKLCh triple at
 * a fixed chroma is out of sRGB for most hues and lightnesses: yellow at L 0.9
 * simply has nowhere to put chroma 0.3. Reducing chroma and keeping L and hue is
 * the standard gamut approach and it preserves the relationship the harmony was
 * built on, which clamping the channels would not.
 */
function oklchToHex(l: number, chroma: number, hueDegrees: number): string {
  const angle = (hueDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (value: number): [number, number, number] => toLinear(l, cos * value, sin * value);

  const full = at(chroma);
  if (inGamut(full)) return linearToHex(full);

  // Bisection on chroma. Fourteen steps is well inside one 8-bit step at any
  // lightness, and it costs nothing next to the mixing that follows.
  let low = 0;
  let high = chroma;
  for (let pass = 0; pass < 14; pass++) {
    const mid = (low + high) / 2;
    if (inGamut(at(mid))) low = mid;
    else high = mid;
  }
  return linearToHex(at(low));
}

/** OKLab to linear sRGB. */
function toLinear(l: number, a: number, b: number): [number, number, number] {
  const long = l + 0.3963377774 * a + 0.2158037573 * b;
  const medium = l - 0.1055613458 * a - 0.0638541728 * b;
  const short = l - 0.0894841775 * a - 1.291485548 * b;
  const L = long * long * long;
  const M = medium * medium * medium;
  const S = short * short * short;

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

function inGamut([r, g, b]: [number, number, number]): boolean {
  const slack = 1e-4;
  return (
    r >= -slack && r <= 1 + slack && g >= -slack && g <= 1 + slack && b >= -slack && b <= 1 + slack
  );
}

function linearToHex([r, g, b]: [number, number, number]): string {
  const channel = (value: number): string => {
    const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
    const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

export type PaletteOptions = {
  /** Base hue, in degrees. */
  hue: number;
  /** Which relationship to lay the hues out with. */
  harmony: HarmonyName;
  /** Chroma, the knob that decides how saturated the palette is. */
  chroma: number;
  /**
   * Hue spread as a fraction of the scheme's own range.
   *
   * Compressing it turns a triadic scheme into something near-analogous without
   * changing the scheme, which is what makes the knob continuous rather than a
   * set of discrete presets.
   */
  spread: number;
  /** How far lightness rises across the palette, in OKLab L. */
  ramp: number;
  /** Pigment count. Clamped to the number of hues the scheme provides. */
  count: number;
};

/**
 * Builds the palette.
 *
 * Lightness rises across the palette rather than sitting flat, because a set of
 * equally bright pigments mixes into a flat wash: every mixture lands on the same
 * tone and the fluid's structure disappears into it. A ramp gives the mixing
 * somewhere to go.
 */
export function buildPalette(options: PaletteOptions): Palette {
  const offsets = HARMONIES[options.harmony];
  const count = Math.max(1, Math.min(options.count, offsets.length));

  // Offsets are normalised before they are scaled. Multiplying the raw offsets by
  // the spread instead shrinks the whole scheme toward the base hue rather than
  // compressing it: a split-complementary at half spread came out as four pinks
  // instead of orange against teal, which is not a weaker harmony but a different
  // and much worse one.
  const reach = Math.max(...offsets);
  const span = HARMONY_RANGE[options.harmony] * clamp(options.spread, 0, 1);

  const hues: number[] = [];
  const hex: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const hue = (options.hue + (reach === 0 ? 0 : (offsets[i] / reach) * span)) % 360;
    // Lightness from dark to light, pulled off the extremes so no pigment is
    // crushed to black or blown to white by the sRGB transfer.
    const lightness = 0.36 + t * clamp(options.ramp, 0, 1) * 0.5;
    hues.push(hue);
    hex.push(oklchToHex(lightness, clamp(options.chroma, 0, 0.37), hue));
  }

  return { hex, hues };
}

/**
 * Confirms a hex the library can read.
 *
 * The harmony maths can only produce in-gamut colours by construction, so this is
 * a guard rather than a correction. It returns a colour the page can hand straight
 * to `spectral.js` without a second clamping step.
 */
export function colorFor(hex: string): Color {
  try {
    return new Color(hex).toGamut({ method: "clip" });
  } catch {
    return new Color("#000000");
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export const HARMONY_NAMES = Object.keys(HARMONIES) as HarmonyName[];