/*
 * Emitters.
 *
 * The aesthetic layer, deliberately kept out of the solver. A vent is a function
 * of grid size and time returning a position, a flow and a pigment, so the physics
 * never has to know what a "ribbon" or a "bloom" is. Retuning the look is editing
 * this file; it is not editing the fluid.
 *
 * Coordinates are normalised 0..1 and resolved against the grid at call time, so
 * the same family reads correctly on a phone and on a wide monitor, and after a
 * resize that changes the aspect entirely.
 *
 * The layout is the part that matters most and the part that is least obvious.
 * An earlier version derived the number of rows from the board's aspect ratio,
 * which packs the emitters into two horizontal bands on anything wide. The
 * picture above those bands looks fine and the bottom fifth stays bare paper
 * forever, because no emitter is near it and the flow there is horizontal. Laying
 * the rows out explicitly, so the first and last rows are always populated, is
 * what fixes it.
 */

export type VentPlacement = {
  /** Grid cell position. */
  x: number;
  y: number;
  /** Flow speed in cells per second. */
  speed: number;
  /** Direction in radians. */
  angle: number;
  /** Which pigment this vent carries. */
  channel: number;
  /**
   * How much dye it deposits per second.
   *
   * Per second, not per step, so the picture runs at the same pace at 30fps and
   * at 144fps.
   */
  rate: number;
  /**
   * Width of the emitter line, in cells. Zero is a single point.
   *
   * A line rather than a point is what leaves a ribbon: one point only dimples
   * the field, and what it leaves travels as a dot rather than as a stroke.
   */
  sweep: number;
};

export type Vent = (width: number, height: number, time: number) => VentPlacement;

type Spec = Omit<VentPlacement, "x" | "y" | "channel">;

type Motion = {
  /** Path half-extent, in cells. */
  ax: number;
  ay: number;
  /** Path frequencies, in radians per second. */
  fx: number;
  fy: number;
  /** Phase offsets, so two vents on similar paths do not move together. */
  px: number;
  py: number;
};

/**
 * A vent on a Lissajous path.
 *
 * Two incommensurable frequencies are the whole trick. With one frequency every
 * vent retraces the same line and the pattern locks into a visible loop; with two
 * that do not divide evenly the path does not repeat on any timescale a visitor
 * will sit through.
 */
function orbiting(spec: Spec & { channel: number }, motion: Motion): Vent {
  return (width, height, time) => ({
    ...spec,
    x: (0.5 + (motion.ax / Math.max(width, 1)) * Math.sin(time * motion.fx + motion.px)) * width,
    y: (0.5 + (motion.ay / Math.max(height, 1)) * Math.sin(time * motion.fy + motion.py)) * height,
  });
}

type Layout = {
  count: number;
  rows: number;
  /** Direction spread in radians. Zero is all-horizontal bands. */
  spread: number;
  spec: Spec;
  /** How far each vent drifts, in cells. */
  drift: number;
};

/**
 * Scatters `count` vents over the board, guaranteed to reach both edges.
 *
 * `rows` is explicit for the reason in the file header. Angles alternate by row so
 * the field is not a set of parallel bands, then jittered by `spread`, which is
 * what supplies the vertical transport the board needs to fill.
 */
function scatter(layout: Layout): Vent[] {
  const { count, rows, spread, spec, drift } = layout;
  const columns = Math.max(1, Math.ceil(count / rows));
  const vents: Vent[] = [];

  for (let i = 0; i < count; i++) {
    const column = i % columns;
    const row = Math.min(rows - 1, (i / columns) | 0);
    // Deterministic jitter. A hash, not `Math.random`, so the composition is the
    // same on every load and every device.
    const jx = (((i * 7919) % 97) / 97 - 0.5) * 0.6;
    const jy = (((i * 6271) % 89) / 89 - 0.5) * 0.6;
    const wobble = (((i * 4211) % 100) / 100 - 0.5) * spread;
    const angle = (row % 2 === 0 ? 0 : Math.PI) + wobble;
    const phase = i * 2.399;

    vents.push((width, height, time) => ({
      ...spec,
      angle,
      // A raw slot index. The simulation wraps it to however many pigments the
      // page happens to be showing, so a family with thirty vents and a page with
      // three wells still cycles through all three instead of reading undefined.
      channel: i,
      x: ((column + 0.5) / columns + (jx / columns) + (drift / Math.max(width, 1)) * Math.cos(time * 0.21 + phase)) * width,
      y: ((row + 0.5) / rows + (jy / rows) + (drift / Math.max(height, 1)) * Math.sin(time * 0.17 + phase)) * height,
    }));
  }

  return vents;
}

export const VENT_FAMILIES: Record<string, Vent[]> = {
  /**
   * Tide.
   *
   * The layout the look was tuned against: vents over the full height, alternating
   * direction, enough vorticity to fold the field and enough dissipation that old
   * pigment clears instead of averaging into a single flat colour. Twelve seconds
   * in, nothing on the board is still the colour it started as.
   */
  tide: scatter({
    count: 24,
    rows: 6,
    spread: 3.2,
    drift: 4,
    spec: { speed: 26, rate: 6, sweep: 6, angle: 0 },
  }),

  /**
   * Storm.
   *
   * The same shape with everything turned up: twice the vents, faster flow, more
   * vorticity. The filaments get thinner and the board holds more distinct
   * structure because old pigment is replaced faster than it can blend away.
   */
  storm: scatter({
    count: 32,
    rows: 8,
    spread: 4,
    drift: 7,
    spec: { speed: 40, rate: 8, sweep: 5, angle: 0 },
  }),

  /**
   * Silt.
   *
   * Slow and heavily damped. Viscous rather than energetic: long horizontal folds
   * that drift across the board. The clearest of the three for reading what the
   * mixing actually does, since there is time to watch one colour cross into
   * another.
   */
  silt: scatter({
    count: 18,
    rows: 6,
    spread: 2.2,
    drift: 10,
    spec: { speed: 11, rate: 7, sweep: 10, angle: 0 },
  }),

  /**
   * Orbit.
   *
   * A handful of spinning bodies rather than a field. The dye leaves each one in a
   * spiral that wraps into itself, which is the clearest possible demonstration of
   * vorticity confinement doing its job.
   */
  orbit: [
    orbiting(
      { speed: 8, rate: 6, sweep: 0, angle: 0, channel: 0 },
      { ax: 34, ay: 9, fx: 0.17, fy: 0.21, px: 0.3, py: 2.2 }
    ),
    orbiting(
      { speed: -7, rate: 5.5, sweep: 0, angle: 0, channel: 1 },
      { ax: 44, ay: 12, fx: 0.23, fy: 0.13, px: 3.4, py: 0.8 }
    ),
    orbiting(
      { speed: 6, rate: 5, sweep: 0, angle: 0, channel: 2 },
      { ax: 26, ay: 7, fx: 0.11, fy: 0.27, px: 1.9, py: 4.4 }
    ),
    orbiting(
      { speed: -5, rate: 4.5, sweep: 0, angle: 0, channel: 3 },
      { ax: 52, ay: 14, fx: 0.29, fy: 0.19, px: 5.2, py: 2.8 }
    ),
  ],
};

export const VENT_FAMILY_NAMES = Object.keys(VENT_FAMILIES);