/*
 * The splash's still frame, shared by both renderers.
 *
 * The CSS composition in `BootScreen.astro` and the three.js scene have to agree on
 * the opening frame exactly, because one crossfades into the other and any
 * difference shows as the drawing jumping at the moment the canvas takes over. So
 * the depth, the cut parameters, the seed and the ink assignment all live here and
 * both renderers read them. A `Math.random()` at the scene's mount would make that
 * impossible, which is also why the splash starts from a fixed seed: the reduced
 * motion and no-WebGL answers are then a true still of the animation rather than
 * an arbitrary one.
 */

import { subdivide, type Cell } from "../recursion/subdivide";

/** Eight cells, about as many as read at the size the stage renders. */
export const splashDepth = 3;

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
export function splashFrame(beat: number): SplashFrame {
  const seed = (SPLASH_SEED + beat) % BEATS;
  const cells = subdivide({ depth: splashDepth, ...CUT, seed });
  return { cells, ink: cells.map((_, index) => isInk(index, seed)) };
}