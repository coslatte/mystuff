/*
 * Kubelka-Munk mixing.
 *
 * The one piece of colour maths the whole spectral page shares. Both paint layers
 * — the fluid field and the manual strokes — end up here, which is what keeps the
 * two looking like the same paint instead of two unrelated colour pipelines.
 *
 * Framework-free and DOM-free on purpose. Nothing in this file knows that a canvas
 * exists, so the same mixing can drive a page background, an SVG stop list or a
 * WebGL texture later without being rewritten.
 */

import { Color } from "spectral.js";

/** Reflectance samples per curve. Fixed by the library. */
const SAMPLES = 38;

/**
 * Bits of concentration kept in the cache key.
 *
 * Concentrations are stored as a ratio against the strongest pigment, because
 * that is all the mix equation cares about: only relative amounts change the
 * result, so the absolute scale is free to discard.
 *
 * The bucketing is linear rather than logarithmic, and that is not an arbitrary
 * choice. A trace pigment is exactly the case a pigment simulation produces and
 * where the eye is most sensitive: a few hundredths of a red in a yellow mix reads
 * as a different paint. A log grid spent all its resolution at the top of the
 * range and collapsed everything under one percent of the peak onto a single
 * bucket, which put a visible 29/255 error on those cells. Twelve bits put the
 * smallest distinguishable step at a quarter of a thousandth of the peak instead.
 *
 * It is also the better key for cache hits, which was not the point: neighbouring
 * cells in a fluid field have near-equal concentrations, and a linear grid gives
 * them identical buckets while a log grid spread them apart.
 */
const CACHE_BITS = 12;
const CACHE_STEPS = 1 << CACHE_BITS;

export type Pigment = {
  /** K/S per reflectance sample. */
  ks: Float32Array;
  /**
   * Concentration this pigment deposits per unit of brush flow.
   *
   * The library weighs a mix by `factor^2 * tintingStrength^2 * luminance`, so
   * folding the three into one number here is what lets a dab deposit "some of
   * this pigment" rather than a finished colour.
   */
  concentration: number;
  /** sRGB hex, for the UI. Not used by the mixing. */
  hex: string;
};

/**
 * Builds a paintable pigment from a colour and the two knobs that affect it.
 *
 * `weight` is the library's mix factor and `strength` its tinting strength. The
 * library squares both, so they are squared once here instead of per pixel.
 */
export function makePigment(color: Color, weight: number, strength: number): Pigment {
  const gamut = color.toGamut({ method: "clip" });
  return {
    ks: Float32Array.from(gamut.KS),
    concentration:
      Math.pow(Math.max(0, weight), 2) * Math.pow(Math.max(0, strength), 2) * gamut.luminance,
    hex: gamut.toString({ method: "clip" }),
  };
}

export type RGB = readonly [number, number, number];

export type MixCache = {
  /**
   * Mixes per-pigment concentrations into sRGB, memoised on a quantised ratio.
   *
   * Takes an offset rather than a slice because the callers are per-cell loops: a
   * `subarray` per cell would allocate one object per cell per frame, which at
   * simulation resolution is the single largest source of garbage on the page.
   *
   * Built for one pigment set. Two surfaces sharing a cache also share its
   * entries, so a colour the fluid already produced costs nothing when a manual
   * stroke crosses the same colour.
   */
  rgb: (amounts: Float32Array, offset: number) => RGB;
  /** Entries held. Exposed so a page can report what the memoisation is worth. */
  readonly size: number;
};

/** Entries before the cache drops everything, so a runaway mix cannot leak. */
const MAX_ENTRIES = 40000;

/**
 * Builds a memoising mixer for one pigment set.
 *
 * Without this the alternative is a `Color` allocation per cell per frame: at the
 * solver's resolution that is hundreds of thousands of full curve conversions a
 * second, which is the difference between a smooth simulation and a frozen tab.
 */
export function createMixCache(pigments: Pigment[]): MixCache {
  const cache = new Map<number, RGB>();
  const curve = new Float32Array(pigments[0]?.ks.length || SAMPLES);
  const count = pigments.length;

  /**
   * The scratch curve handed to `Color`.
   *
   * A plain `Array`, reused, because `Color`'s constructor branches on
   * `Array.isArray` and a `Float32Array` fails that check, leaving an empty
   * colour. `Array.from` per conversion costs more than the conversion itself, so
   * the array is allocated once and overwritten.
   *
   * `Color` keeps the array by reference rather than copying it. That is fine
   * here and only here: the `Color` is read and dropped inside this function, so
   * nothing is ever left holding a curve that the next call is rewriting.
   */
  const scratch: number[] = new Array(curve.length);

  return {
    get size() {
      return cache.size;
    },
    rgb(amounts, offset) {
      const key = mixKey(amounts, offset, count);
      const hit = cache.get(key);
      if (hit) return hit;

      let total = 0;
      for (let i = 0; i < count; i++) total += read(amounts, offset, i);

      for (let s = 0; s < curve.length; s++) {
        let weighted = 0;
        for (let i = 0; i < count; i++) {
          weighted += pigments[i].ks[s] * read(amounts, offset, i);
        }
        const ks = weighted / total;
        // Inverse Kubelka-Munk: K/S back to a reflectance curve.
        scratch[s] = 1 + ks - Math.sqrt(ks * ks + 2 * ks);
      }

      // The library owns the colour science from here on: reflectance to CIE XYZ
      // to linear RGB to sRGB, with its D65 illuminant and its 38-sample tables.
      // Reading `.sRGB` and clamping by hand is its `clip` gamut method without
      // the second `Color` that `toGamut` rebuilds just to return an object, which
      // cost three times as much as the conversion it was wrapping.
      const color = new Color(scratch);
      const rgb: RGB = [
        clamp255(color.sRGB[0]),
        clamp255(color.sRGB[1]),
        clamp255(color.sRGB[2]),
      ];

      if (cache.size >= MAX_ENTRIES) cache.clear();
      cache.set(key, rgb);
      return rgb;
    },
  };
}

function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Folds concentrations into one number.
 *
 * Pairs are combined before they are folded together so the running product stays
 * inside the exact integer range: two pairs of 80^2 is 2.7e8, where four raw
 * buckets would have been 2^56 and silently aliased two different mixes onto one.
 */
function mixKey(amounts: Float32Array, offset: number, count: number): number {
  const peak = peakOf(amounts, offset, count);
  let key = 0;
  for (let c = 0; c < count; c += 2) {
    const a = bucket(read(amounts, offset, c), peak);
    const b = count > 1 ? bucket(read(amounts, offset, c + 1), peak) : 0;
    key = key * CACHE_STEPS * CACHE_STEPS + a * CACHE_STEPS + b;
  }
  return key;
}

/**
 * Reads a channel, treating an index past the end of the buffer as zero.
 *
 * The caller already bounds the loop by the pigment count, so this only guards the
 * case where a surface holds more slots than the pigment set fills and a stale
 * amount is still sitting in one of them.
 */
function read(amounts: Float32Array, offset: number, index: number): number {
  const at = offset + index;
  return at < amounts.length ? amounts[at] : 0;
}

function peakOf(amounts: Float32Array, offset: number, count: number): number {
  let peak = 0;
  for (let i = 0; i < count; i++) {
    const value = amounts[offset + i];
    if (value > peak) peak = value;
  }
  return peak;
}

function bucket(amount: number, peak: number): number {
  if (!(amount > 0) || !(peak > 0)) return 0;
  const value = Math.round((amount / peak) * CACHE_STEPS);
  return value >= CACHE_STEPS ? CACHE_STEPS - 1 : value;
}