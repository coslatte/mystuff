/* A fixed seed keeps the server fallback and the first animated frame identical. */

import { subdivide, type Cell } from "../graphics/recursion/subdivide";

/** Sixteen cells keep the square stage legible on phones. */
export const splashDepth = 4;

/** Fixed so the first frame is reproducible; beats after that increment it. */
export const SPLASH_SEED = 41307;

/** How far the opening frame sits from a plain grid, and how much it inherits. */
const CUT = { irregularity: 0.3, grain: 0.25, bias: 0.6 };

/** Beats before the seed repeats. Far longer than any splash that ever ran. */
const BEATS = 1000;

export type SplashFrame = {
  cells: Cell[];
  /** Which cells are ink rather than paper. */
  ink: boolean[];
};

/**
 * Roughly half the cells inked, from position and seed.
 *
 * Independent per cell so no two beats look alike, but a pure function of the beat
 * so both renderers agree on it. A random draw here would repaint the composition
 * differently in the fallback and in the canvas.
 */
function isInk(index: number, seed: number): boolean {
  return ((Math.imul(index + 1, 2246822519) ^ Math.imul(seed, 3266489917)) >>> 0) % 2 === 0;
}

/** The frame for one beat of the clock. Beat 0 is what both renderers open on. */
export function splashFrame(beat: number, phase = 0, depth = splashDepth): SplashFrame {
  const seed = (SPLASH_SEED + beat) % BEATS;
  const cells = subdivide({ depth, ...CUT, seed, phase });
  return { cells, ink: cells.map((_, index) => isInk(index, seed)) };
}

export const curtainCells = () => splashFrame(0, 0, 5);
