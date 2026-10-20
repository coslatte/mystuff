/*
 * Emitter layouts.
 *
 * The aesthetic layer, deliberately kept out of the solver. A layout is a function
 * of grid size and time returning where an emitter sits, which way it points and
 * which pigment it carries; how fast it moves and how much it deposits are page
 * controls, applied by the simulation. Splitting those two is what lets a slider
 * change the character of the flow without restarting it.
 *
 * Coordinates are normalised 0..1 and resolved against the grid at call time, so
 * the same layout reads correctly on a phone and on a wide monitor, and after a
 * resize that changes the aspect entirely.
 */

export type Emitter = {
  /** Grid cell position. */
  x: number;
  y: number;
  /** Direction in radians. */
  angle: number;
  /** Which pigment this emitter carries. */
  channel: number;
  /**
   * Relative dose, 0..1. Lets one layout put most of its pigment down in a couple
   * of places and the rest elsewhere, without changing the global density knob.
   */
  weight: number;
  /**
   * Rotation about the middle of the board, in multiples of the speed.
   *
   * A direction on its own can only push an emitter in a straight line. Adding a
   * tangential component about the centre is what turns a group of them into
   * actual vortices, which is the one thing a straight push cannot produce and the
   * clearest demonstration of the vorticity term doing its job.
   */
  swirl?: number;
};

export type Layout = (width: number, height: number, time: number) => Emitter[];

type Seed = { count: number; rows: number; spread: number; drift: number; weights?: number[] };

/**
 * Scatters emitters over the board, guaranteed to reach both edges.
 *
 * `rows` is explicit for a reason that cost a lot of guessing: deriving it from
 * the board's aspect ratio packs the emitters into two horizontal bands on
 * anything wide. The picture above the bands looks fine and the bottom of it stays
 * bare paper forever, because no emitter is near there and the flow is horizontal.
 * Laying the rows out so the first and the last are always populated is the fix.
 *
 * Direction alternates by row and is then jittered by `spread`, which is what
 * supplies the vertical transport the board needs in order to fill.
 *
 * The jitter is a hash rather than `Math.random`, so the composition is identical
 * on every load and every device. Randomness the visitor cannot ask for is just a
 * different picture on each reload, which is not what a "seed" is for.
 */
function scatter(seed: Seed): Layout {
  const { count, rows, spread, drift } = seed;
  const columns = Math.max(1, Math.ceil(count / rows));

  return (width, height, time) => {
    const out: Emitter[] = new Array(count);

    for (let i = 0; i < count; i++) {
      const column = i % columns;
      const row = Math.min(rows - 1, (i / columns) | 0);
      const jx = (((i * 7919) % 97) / 97 - 0.5) * 0.6;
      const jy = (((i * 6271) % 89) / 89 - 0.5) * 0.6;
      const wobble = (((i * 4211) % 100) / 100 - 0.5) * spread;
      const phase = i * 2.399;

      out[i] = {
        angle: (row % 2 === 0 ? 0 : Math.PI) + wobble,
        channel: i,
        weight: seed.weights?.[i % seed.weights.length] ?? 1,
        x: ((column + 0.5) / columns + jx / columns + (drift / Math.max(width, 1)) * Math.cos(time * 0.21 + phase)) * width,
        y: ((row + 0.5) / rows + jy / rows + (drift / Math.max(height, 1)) * Math.sin(time * 0.17 + phase)) * height,
      };
    }

    return out;
  };
}

/**
 * Counter-rotating bodies on a slowly drifting ring.
 *
 * Three of them turn one way and three the other, at different radii. A ring that
 * all turns the same way just spins the board; opposing pairs shear against each
 * other, which is what produces the paired vortices and the shear lines between
 * them.
 */
function vortices(count: number, radius: number, spin: number): Layout {
  return (width, height, time) => {
    const half = Math.min(width, height);
    return new Array(count).fill(0).map((_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const orbit = time * (0.11 + (i % 3) * 0.037) + (i / count) * Math.PI * 2;
      const reach = radius * (0.55 + ((i * 37) % 11) / 22);
      const wobble = 1 + 0.12 * Math.sin(time * 0.23 + i * 1.9);
      return {
        x: (0.5 + (reach * Math.cos(orbit) * wobble) / half) * width,
        y: (0.5 + (reach * Math.sin(orbit) * wobble) / half) * height,
        // Outward, so each body also feeds the ring rather than only turning it.
        angle: orbit,
        channel: i,
        weight: 0.75 + ((i * 53) % 7) / 14,
        swirl: side * spin,
      };
    });
  };
}

/**
 * The layouts the page offers.
 *
 * Four, and each is a different regime rather than a different seed of the same
 * one: a field, a faster field, a slow viscous one, and a small number of spinning
 * bodies. Everything finer is a knob, not another entry in this list.
 */
export const LAYOUTS = {
  /** Even field across the whole board. The default. */
  tide: scatter({ count: 24, rows: 6, spread: 3.2, drift: 4 }),
  /** Denser and faster. Thinner filaments, more distinct structure. */
  storm: scatter({ count: 32, rows: 8, spread: 4, drift: 7 }),
  /** Slow and heavy. Long folds, and time to watch one colour cross into another. */
  silt: scatter({ count: 18, rows: 6, spread: 2.2, drift: 10 }),
  /** Six counter-rotating bodies. Paired vortices with shear lines between them. */
  orbit: vortices(10, 42, 2.2),
} satisfies Record<string, Layout>;

export type LayoutName = keyof typeof LAYOUTS;

export const LAYOUT_NAMES = Object.keys(LAYOUTS) as LayoutName[];