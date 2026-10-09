/*
 * Diagnostic views of the velocity field.
 *
 * The pigment is the product, and once the board looks good there is no way to tell
 * from the picture whether it got there because the flow is fast, because the field
 * is rotating, or because the vorticity term is diverging. This is the layer that
 * answers that, and it is deliberately the least pretty part of the page.
 *
 * Writes straight into a caller's RGBA buffer instead of allocating an `ImageData`,
 * so it can be rendered headless by the preview script and reused by the canvas
 * without a second code path.
 *
 * The overlay carries its magnitude in alpha and its kind in hue, so the component
 * can composite it over the paint with one `drawImage` and no per-pixel blending in
 * JavaScript.
 */

import type { VelocityField } from "./tracers";

export type FieldViewMode = "off" | "speed" | "curl";

export const FIELD_VIEW_MODES: readonly FieldViewMode[] = ["off", "speed", "curl"];

/**
 * Speed that maps to full strength, in cells per second.
 *
 * Below it the ramp is compressed towards zero and above it everything clips. The
 * emitter speed knob tops out at 60 and vorticity routinely doubles the local value
 * near a filament, so this sits above the usual range: a view where most of the
 * board is clipped tells you the gain is wrong, not that the board is fast.
 */
const SPEED_CEILING = 140;

/** Curl beyond this magnitude, in cells per second per cell, reads as full strength. */
const CURL_CEILING = 0.9;

/** Writes one view of the field into `out`, which must hold `width * height * 4` bytes. */
export function writeFieldView(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  field: VelocityField,
  mode: FieldViewMode,
  gain = 1
): void {
  if (mode === "off") {
    out.fill(0);
    return;
  }

  const lastX = width - 1;
  const lastY = height - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const u = field.u[y * width + x];
      const v = field.v[y * width + x];

      if (mode === "speed") {
        const magnitude = Math.min(1, Math.sqrt(u * u + v * v) / SPEED_CEILING);
        const t = Math.pow(magnitude, 0.65) * gain;
        // Indigo through cyan to a warm white. The midpoint of a two-stop ramp lands
        // on a desaturated pink, which at this alpha reads as a white wash over the
        // paint instead of as a reading of the field.
        const slow = t < 0.5;
        const k = slow ? t * 2 : (t - 0.5) * 2;
        const from = slow ? [48, 40, 120] : [30, 200, 220];
        const to = slow ? [30, 200, 220] : [255, 242, 205];
        out[offset] = from[0] + (to[0] - from[0]) * k;
        out[offset + 1] = from[1] + (to[1] - from[1]) * k;
        out[offset + 2] = from[2] + (to[2] - from[2]) * k;
        // Still cells stay nearly clear: the view is meant to sit over the paint, and
        // a floor of full opacity everywhere turns the board into a heat map of
        // itself.
        out[offset + 3] = 255 * clamp01(0.12 + t * 0.7);
        continue;
      }

      const curl = curlAt(field, x, y, lastX, lastY);
      const signed = clamp01((curl / CURL_CEILING) * gain * 0.5 + 0.5);
      // Diverging ramp around zero. Rotating one way and the other look identical
      // in a single-hue view, which is the one thing this view exists to separate.
      out[offset] = 255 * signed;
      out[offset + 1] = 255 * (1 - Math.abs(signed * 2 - 1));
      out[offset + 2] = 255 * (1 - signed);
      out[offset + 3] = 255 * Math.abs(signed * 2 - 1) * 0.85;
    }
  }
}

/**
 * Rotational rate about a cell, by central differences with clamped edges.
 *
 * One-sided differences at the border rather than a mirrored neighbour, because the
 * mirrored version reports the border cells as vortices that are not there.
 */
function curlAt(field: VelocityField, x: number, y: number, lastX: number, lastY: number): number {
  const left = x > 0 ? x - 1 : 0;
  const right = x < lastX ? x + 1 : lastX;
  const above = y > 0 ? y - 1 : 0;
  const below = y < lastY ? y + 1 : lastY;
  const row = y * field.width;
  return (field.v[row + right] - field.v[row + left] - (field.u[below * field.width + x] - field.u[above * field.width + x])) * 0.5;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}