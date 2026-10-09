/*
 * Paint surface.
 *
 * A grid where pigment mixes the way paint mixes: every cell holds how much of each
 * pigment landed there, and where deposits overlap they resolve into a colour nobody
 * chose. That is what spectral.js is actually for, and a list of gradients does not
 * show it.
 *
 * The trick that makes it affordable is that the only thing worth remembering per
 * cell is how much of each pigment landed there. Everything else is derived on
 * demand by `lib/pigment-math`:
 *
 *     KS(cell) = sum(concentration_i * KS_i) / sum(concentration_i)
 *
 * so a 38-sample reflectance curve collapses into one number per pigment, and the
 * expensive colour conversion only runs for cells that changed.
 *
 * Nothing deposits here. The caller writes `amounts` directly and says which cells
 * moved, which is what the fluid does every step; the surface's whole job is
 * resolving those amounts into colour, which is why it has no brush on it.
 *
 * Framework-free on purpose. No React, no DOM: the caller owns the canvas and the
 * frame loop.
 */

import type { MixCache } from "./pigment-math";

export type DirtyRect = { x: number; y: number; width: number; height: number };

/**
 * A fixed-size accumulation grid.
 *
 * `width` and `height` are in the surface's own cells. Callers pick the cell size
 * that suits them; nothing here assumes pixels.
 */
export class PaintSurface {
  readonly width: number;
  readonly height: number;
  /** `channels` floats per cell, interleaved as c, c, c, ... across the row. */
  readonly amounts: Float32Array;
  /** The flushed colours, ready for `putImageData`. */
  readonly image: ImageData;

  private readonly channels: number;
  private readonly cache: MixCache;
  /** Total pigment per cell, kept only while relief is on. */
  private readonly coverage: Float32Array;
  private relief = 0;
  private minX = 0;
  private minY = 0;
  private maxX = -1;
  private maxY = -1;

  constructor(width: number, height: number, channels: number, cache: MixCache) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.channels = Math.max(1, Math.floor(channels));
    this.amounts = new Float32Array(this.width * this.height * this.channels);
    this.coverage = new Float32Array(this.width * this.height);
    this.cache = cache;
    // Allocated here rather than through a 2D context so the module never has to
    // be handed one, and so the surface can be built in a worker later.
    this.image = new ImageData(this.width, this.height);
  }

  /**
   * How much the pigment's own thickness shades the colour, 0..1.
   *
   * A wash has no surface: every cell holding pigment resolves to its mixture, so a
   * thick fold and a thin one land on the same colour and the picture reads flat
   * however much structure the flow built. Treating total concentration as a height
   * field and lighting it puts the thickness back, and it is the only depth cue
   * available without a second render target.
   *
   * Set before `flush`; it costs one extra pass over the grid.
   */
  setRelief(amount: number): void {
    const next = Math.max(0, amount);
    if (next === this.relief) return;
    this.relief = next;
    // The shading changes the colour of every cell, so the whole grid is dirty. Not
    // doing this leaves a relief slider that moves and nothing redraws: `flush` only
    // revisits what was invalidated, and by the time the knob moves the last frame
    // has already been painted and reset.
    this.markDirty(0, 0, this.width - 1, this.height - 1);
  }

  private get isEmpty(): boolean {
    return this.maxX < this.minX;
  }

  private markDirty(minX: number, minY: number, maxX: number, maxY: number): void {
    if (this.isEmpty) {
      this.minX = minX;
      this.minY = minY;
      this.maxX = maxX;
      this.maxY = maxY;
      return;
    }
    this.minX = Math.min(this.minX, minX);
    this.minY = Math.min(this.minY, minY);
    this.maxX = Math.max(this.maxX, maxX);
    this.maxY = Math.max(this.maxY, maxY);
  }

  /**
   * Marks cells dirty without touching them.
   *
   * The fluid writes `amounts` in place and then says so; without this the surface
   * would have no way to know which cells to look at.
   */
  invalidate(minX: number, minY: number, maxX: number, maxY: number): void {
    this.markDirty(
      Math.max(0, Math.floor(minX)),
      Math.max(0, Math.floor(minY)),
      Math.min(this.width - 1, Math.ceil(maxX)),
      Math.min(this.height - 1, Math.ceil(maxY))
    );
  }

  /**
   * Recolours every cell that changed since the last call.
   *
   * Returns the region it touched, or null when nothing was dirty, so the caller can
   * skip a frame entirely rather than repaint a grid whose contents did not move.
   *
   * `alpha` is written as coverage rather than as a colour: a cell holding no
   * pigment at all becomes transparent, so bare paper is distinguishable from black
   * paint.
   */
  flush(alpha = 255): DirtyRect | null {
    if (this.isEmpty) return null;

    const rect: DirtyRect = {
      x: this.minX,
      y: this.minY,
      width: this.maxX - this.minX + 1,
      height: this.maxY - this.minY + 1,
    };

    const out = this.image.data;
    const lit = this.relief > 0;

    // Relief needs the totals of a cell's neighbours, and those may sit outside the
    // dirty rect, so the coverage pass covers the whole grid rather than the rect.
    if (lit) this.measureCoverage();

    for (let py = rect.y; py < rect.y + rect.height; py++) {
      const above = py > 0 ? py - 1 : 0;
      const below = py < this.height - 1 ? py + 1 : this.height - 1;

      for (let px = rect.x; px < rect.x + rect.width; px++) {
        const cell = py * this.width + px;
        const base = cell * this.channels;

        let total = 0;
        for (let c = 0; c < this.channels; c++) total += this.amounts[base + c];

        const offset = cell * 4;
        if (total <= 1e-9) {
          out[offset] = 0;
          out[offset + 1] = 0;
          out[offset + 2] = 0;
          out[offset + 3] = 0;
          continue;
        }

        const rgb = this.cache.rgb(this.amounts, base);
        const shade = lit ? this.shadeAt(px, py, above, below) : 1;
        out[offset] = rgb[0] * shade;
        out[offset + 1] = rgb[1] * shade;
        out[offset + 2] = rgb[2] * shade;
        out[offset + 3] = alpha;
      }
    }

    this.minX = 0;
    this.minY = 0;
    this.maxX = -1;
    this.maxY = -1;
    return rect;
  }

  private measureCoverage(): void {
    const { coverage, amounts, channels } = this;
    for (let cell = 0; cell < coverage.length; cell++) {
      const base = cell * channels;
      let total = 0;
      for (let c = 0; c < channels; c++) total += amounts[base + c];
      coverage[cell] = total;
    }
  }

/**
 * Lambert term from the concentration gradient, centred on 1.
 *
 * The response is a soft knee rather than a linear gain. The gradient on a
 * transported field is heavy tailed: most cells differ from their neighbour by a few
 * thousandths and a handful differ by a tenth, so any single scale that makes the
 * folds visible also blows the hard edges out to black and white. Dividing by
 * `|slope| + KNEE` keeps the mid range responsive and rolls the tails off instead of
 * clipping them.
 */
private shadeAt(px: number, py: number, above: number, below: number): number {
    const { coverage, width } = this;
    const left = px > 0 ? px - 1 : 0;
    const right = px < width - 1 ? px + 1 : width - 1;
    const slopeX = coverage[py * width + right] - coverage[py * width + left];
    const slopeY = coverage[below * width + px] - coverage[above * width + px];
    const slope = slopeX * LIGHT_X + slopeY * LIGHT_Y;
    const lit = slope / (Math.abs(slope) + RELIEF_KNEE);
    return 1 + lit * this.relief;
  }
}

/**
 * Light direction for the relief, unit length and pointing down-right.
 *
 * Fixed rather than a knob: one light with one direction is what makes the thickness
 * readable as thickness. Two of them, or a light that follows the pointer, produces
 * a picture where every fold claims to be a highlight.
 */
const LIGHT_X = 0.6;
const LIGHT_Y = 0.8;

/**
 * Coverage difference at which the relief is half strength.
 *
 * Half a percent of full pigment between neighbouring cells, which is a thin fold
 * rather than an edge.
 */
const RELIEF_KNEE = 0.005;
