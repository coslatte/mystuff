/*
 * The pigment simulation.
 *
 * The reusable core: a velocity field, a dye field whose channels are pigments, an
 * emitter layout, and a `PaintSurface` that mixes the dye through Kubelka-Munk.
 *
 * It knows nothing about the DOM, about React, about `requestAnimationFrame` or
 * about how large the element it will be drawn into is. A page background, a
 * full-bleed hero canvas, an `OffscreenCanvas` in a worker and a frame exporter
 * are all the same call to `advance(dt)` followed by `paint()`.
 *
 * The separation is the point. A site-wide background cannot afford a React
 * component, and certainly not one that owns a fluid solver; this file is the part
 * worth keeping, and the component is the part that adapts it to a canvas.
 */

import { PaintSurface } from "../paint-surface";
import { createMixCache } from "../pigment-math";
import type { Pigment } from "../pigment-math";
import { FluidSolver } from "./fluid";
import type { FluidControls } from "./fluid";
import { LAYOUTS } from "./layouts";
import type { Layout } from "./layouts";
import type { VelocityField } from "./tracers";

/** The knobs, in the units the solver uses. */
export type Flow = FluidControls & {
  /** Emitter speed, in cells per second. */
  speed: number;
  /** Dye deposited per second, as a multiple of each pigment's concentration. */
  density: number;
  /** Emitter line width, in cells. Zero is a point. */
  sweep: number;
  /**
   * Rotation applied to every emitter's direction, in degrees.
   *
   * It lives here and not in the layouts because it is a property of the board, not
   * of a composition: turning the whole flow to 90 degrees has to leave every layout
   * pointing the same new way, including the ones whose direction is the composition.
   * Swirl is left alone, because swirl is tangential to the centre and rotating it
   * would spin the vortices rather than aim them.
   */
  heading: number;
};

export type SimulationConfig = {
  /** Pigments to mix. The channel count follows, so this and the page must agree. */
  pigments: Pigment[];
  /** Emitter layout. Defaults to the even field. */
  layout?: Layout;
  /** Initial flow. Any field can be changed later without losing the field. */
  flow?: Partial<Flow>;
};

export type PigmentSimulation = {
  readonly width: number;
  readonly height: number;
  /** Steps the flow, injects pigment and resamples the dye onto the surface. */
  advance: (dt: number) => void;
  /** Resolves the dye into colours. Cheap when nothing changed. */
  paint: () => void;
  /** The surface holding the mixed colours. */
  readonly surface: PaintSurface;
  /**
   * The velocity field, for anything that reads the flow rather than the pigment.
   *
   * Handed out instead of copied: tracers and the diagnostic view only sample it,
   * and a copy per frame would cost more than the simulation does.
   */
  readonly field: VelocityField;
  /** Entries the colour memo is holding. Reported so the board can show what it is worth. */
  readonly mixes: number;
  /** Live flow changes. Nothing is rebuilt and the field is untouched. */
  setFlow: (next: Partial<Flow>) => void;
  setLayout: (layout: Layout) => void;
  /**
   * Seats the simulation on a new grid and primes it.
   *
   * Resizing and changing palette both land here, because both invalidate what the
   * stored concentrations meant.
   */
  resize: (width: number, height: number) => void;
  /** Swaps the palette without resizing. Used when a colour knob moves. */
  setPigments: (next: Pigment[]) => void;
  /** Throws the flow away and starts over with a fresh coat. */
  reset: () => void;
  /**
   * Pushes the field toward a velocity over a disc, in cells per second.
   *
   * The pointer's gesture. Relaxation rather than impulse, for the reason
   * `FluidSolver.setVelocity` gives: a held pointer must settle at a speed, not
   * accelerate into the velocity ceiling.
   */
  stir: (x: number, y: number, vx: number, vy: number, radius: number, dt: number) => void;
  /** Lays pigment from one channel over a disc, then lets the flow carry it. */
  deposit: (x: number, y: number, radius: number, channel: number, amount: number) => void;
};

/**
 * Largest step the solver will take, whatever the caller passes.
 *
 * Tighter than it looks like it needs to be: the emitter speeds are in cells per
 * second, so a long frame turns into a long leap and the pigment skips across the
 * field instead of moving through it. A backgrounded tab returning after a minute
 * would otherwise hand the solver one enormous step.
 */
const MAX_DT = 0.05;

/**
 * How fast the flow converges on an emitter's speed, in 1/seconds.
 *
 * High enough that an emitter reaches its speed in a fraction of a second, which is
 * what makes it read as a source of flow rather than as a slow leak.
 */
const VELOCITY_RELAX = 7;

/**
 * Coat laid down on start, as a fraction of each pigment's own concentration.
 *
 * It goes into the solver's dye rather than only onto the surface, because the
 * surface is overwritten from the solver on every step: a coat painted on the
 * surface alone survives exactly one frame and the board is bare again before
 * anyone sees it. In the dye field it is transported and folded by the flow, so it
 * behaves like the thin wash a surface would really start from, and there is never
 * a bare patch for the eye to land on while the picture builds.
 */
const BASE_COAT = 0.02;

const DEFAULT_FLOW: Flow = {
  iterations: 14,
  vorticity: 140,
  velocityDamping: 0.12,
  dyeDamping: 0.4,
  speed: 26,
  density: 6,
  sweep: 6,
  heading: 0,
};

export function createPigmentSimulation(config: SimulationConfig): PigmentSimulation {
  let pigments = config.pigments;
  let channels = Math.max(1, pigments.length);
  let cache = createMixCache(pigments);
  let flow: Flow = { ...DEFAULT_FLOW, ...defined(config.flow) };
  let layout = config.layout ?? LAYOUTS.tide;

  let width = 4;
  let height = 4;
  let solver = new FluidSolver({ ...flow, width, height, channels });
  let surface = new PaintSurface(width, height, channels, cache);
  let time = 0;

  /**
   * One dye vector reused by every emitter in a step.
   *
   * Zeroed before each use so an emitter carrying one pigment cannot smear the
   * previous emitter's pigment into the cells it passes over. Allocated once
   * because `advance` runs on every frame.
   */
  let scratch = new Float32Array(channels);

  function prime(): void {
    for (let i = 0; i < width * height; i++) {
      for (let c = 0; c < channels; c++) {
        const amount = (pigments[c]?.concentration ?? 0) * BASE_COAT;
        solver.dye[i * channels + c] = amount;
        surface.amounts[i * channels + c] = amount;
      }
    }
    surface.invalidate(0, 0, width - 1, height - 1);
  }

  function seat(nextWidth: number, nextHeight: number): void {
    width = Math.max(4, Math.floor(nextWidth));
    height = Math.max(4, Math.floor(nextHeight));
    solver = new FluidSolver({ ...flow, width, height, channels });
    surface = new PaintSurface(width, height, channels, cache);
    time = 0;
    prime();
  }

  function advance(dt: number): void {
    const step = Math.min(MAX_DT, Math.max(0, dt));
    if (step <= 0) return;
    time += step;

    const emitters = layout(width, height, time);
    const sweepSteps = flow.sweep > 0 ? Math.max(2, Math.min(72, Math.round(flow.sweep))) : 1;
    const heading = (flow.heading * Math.PI) / 180;
    const headingCos = Math.cos(heading);
    const headingSin = Math.sin(heading);

    for (const emitter of emitters) {
      // The palette is the page's, and a layout may carry more slots than there
      // are pigments. Wrapping here keeps a thirty-emitter layout cycling through
      // a three-pigment page instead of reading undefined.
      const channel = ((emitter.channel % channels) + channels) % channels;
      const pigment = pigments[channel];
      if (!pigment) continue;

      const dose = pigment.concentration * flow.density * emitter.weight * step;
      const speed = flow.speed;
      const aim = Math.cos(emitter.angle);
      const aimSine = Math.sin(emitter.angle);
      // One rotation of the unit aim vector per emitter, rather than a rotation per
      // component: the heading is constant across the board, so its cosine and sine
      // are computed once per step and reused.
      let pushX = (aim * headingCos - aimSine * headingSin) * speed;
      let pushY = (aimSine * headingCos + aim * headingSin) * speed;

      // Tangential push about the middle of the board. A direction alone can only
      // push an emitter in a straight line, and a straight push cannot make a
      // vortex, which is the one thing worth seeing this simulation do.
      if (emitter.swirl) {
        const radius = Math.hypot(emitter.x - width / 2, emitter.y - height / 2) || 1;
        const turn = emitter.swirl * speed;
        pushX += (-(emitter.y - height / 2) / radius) * turn;
        pushY += ((emitter.x - width / 2) / radius) * turn;
      }

      for (let i = 0; i < sweepSteps; i++) {
        const along = sweepSteps === 1 ? 0 : (i / (sweepSteps - 1) - 0.5) * flow.sweep;
        // The line breathes, which keeps a ribbon from looking like a bar drawn
        // with a ruler.
        const wobble =
          flow.sweep > 0 ? Math.sin(time * 0.7 + (i / sweepSteps) * 6.283) * flow.sweep * 0.1 : 0;
        const x = emitter.x + along;
        const y = emitter.y + wobble;

        solver.setVelocity(x, y, pushX, pushY, VELOCITY_RELAX, step);
        scratch.fill(0);
        scratch[channel] = dose;
        solver.addDye(x, y, scratch);
      }
    }

    solver.step(step);

    // The solver's dye is the source of truth. Copying it over keeps the two
    // concerns apart: the solver knows about velocity and transport, the surface
    // knows about Kubelka-Munk, and neither knows about the other.
    surface.amounts.set(solver.dye);
    surface.invalidate(0, 0, width - 1, height - 1);
  }

  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get surface() {
      return surface;
    },
    get field() {
      return { u: solver.u, v: solver.v, width, height };
    },
    get mixes() {
      return cache.size;
    },
    advance,
    paint() {
      surface.flush(255);
    },
    setFlow(next) {
      flow = { ...flow, ...defined(next) };
      // Tuned live rather than on construction, so a slider does not restart
      // anything. The picture is the thing being adjusted.
      solver.tune(flow);
    },
    setLayout(next) {
      layout = next;
    },
    setPigments(next) {
      pigments = next;
      const nextChannels = Math.max(1, pigments.length);
      if (nextChannels !== channels) {
        // The dye buffer is interleaved by channel count, so a palette of a
        // different size cannot be read in place.
        channels = nextChannels;
        cache = createMixCache(pigments);
        scratch = new Float32Array(channels);
        seat(width, height);
        return;
      }
      cache = createMixCache(pigments);
      seat(width, height);
    },
    resize: seat,
    stir(x, y, vx, vy, radius, dt) {
      solver.drive(x, y, vx, vy, radius, VELOCITY_RELAX, dt);
    },
    deposit(x, y, radius, channel, amount) {
      const index = ((channel % channels) + channels) % channels;
      const pigment = pigments[index];
      if (!pigment) return;
      scratch.fill(0);
      scratch[index] = pigment.concentration * amount;
      solver.addDyeArea(x, y, scratch, radius);
    },
    reset() {
      solver.u.fill(0);
      solver.v.fill(0);
      solver.dye.fill(0);
      prime();
    },
  };
}

function defined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {};
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}