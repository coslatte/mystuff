/*
 * Boot progress model.
 *
 * The splash shows a percentage, so the number has to mean something. Every
 * milestone below is a signal the browser actually emits; the weights exist to
 * turn "four of five things are done" into a number that neither stalls at zero
 * nor sits at 99%.
 *
 * Pure on purpose: no DOM, no timers. The controller owns the wiring and this
 * file only owns the arithmetic, which is what makes the two concerns separable.
 */

export type BootMilestone =
  /** The splash itself is in the DOM and about to paint. */
  | "painted"
  /** CSS and markup are parsed. */
  | "dom"
  /** The two webfonts have loaded, so the text will not re-layout. */
  | "fonts"
  /** React islands have hydrated, or the page has none to hydrate. */
  | "islands"
  /** Every subresource, including images, has finished downloading. */
  | "assets";

/**
 * Weights, not durations.
 *
 * Hydration is weighted heavier than fonts because it is what actually gates
 * interaction on /music. Assets finish the count because they are the slowest
 * signal and the splash exists precisely to cover them.
 */
const WEIGHTS: Record<BootMilestone, number> = {
  painted: 8,
  dom: 32,
  fonts: 62,
  islands: 82,
  assets: 100,
};

/**
 * Above this, progress has not actually been earned yet.
 *
 * Without a ceiling below 100, a slow image would leave the bar looking honest
 * while the counter climbed on its own. The creep may approach 92% and no
 * further; only `assets` or the hard deadline can reach 100.
 */
export const CREEP_CEILING = 92;

export type ProgressState = {
  /** Highest milestone weight reached so far, 0-100. Never decreases. */
  earned: number;
};

/**
 * Advances the model with a milestone. Out-of-order signals are fine: a page
 * whose assets resolve before fonts still reports the larger number, and the
 * `Math.max` keeps the sequence monotonic so the displayed value cannot
 * flicker backwards.
 */
export function markMilestone(state: ProgressState, milestone: BootMilestone): ProgressState {
  const earned = Math.max(state.earned, WEIGHTS[milestone]);
  return earned === state.earned ? state : { earned };
}

/**
 * How much the number is allowed to drift past real progress.
 *
 * A flat counter reads as a frozen page. This lets it creep toward the next
 * milestone so the splash looks alive while a 400KB image downloads, without
 * ever claiming to be finished.
 */
export function creepToward(
  earned: number,
  elapsedMs: number,
  creepWindowMs = 1200
): number {
  if (earned >= CREEP_CEILING) return CREEP_CEILING;
  const ratio = Math.min(1, elapsedMs / Math.max(1, creepWindowMs));
  return Math.min(CREEP_CEILING, earned + (CREEP_CEILING - earned) * ratio);
}

/**
 * Maps the model onto the number that goes on screen.
 *
 * `ramping` covers the gap between the last milestone and 100 so the counter
 * eases into the closing state instead of snapping from 62 to 100. Reaching 100
 * is what the controller waits on before it dismisses the splash.
 */
export function toPercent(earned: number, ramping: number): number {
  const value = Math.max(earned, Math.min(100, ramping));
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Closes the gap between the last milestone and 100 over `progress01`. */
export function rampFrom(earned: number, progress01: number): number {
  if (progress01 >= 1) return 100;
  return earned + (100 - earned) * Math.min(1, Math.max(0, progress01));
}
