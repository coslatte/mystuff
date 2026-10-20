/*
 * Tracers.
 *
 * Massless points carried by the velocity field, drawn as streaks. They exist
 * because the dye field shows *where* the pigment went and not *how it got
 * there*: on a settled board the picture can look identical whether the flow is
 * a fast sheet or a slow churn. A tracer is the only element that reports the
 * field itself.
 *
 * No canvas, no allocation per frame. Positions live in flat arrays the caller
 * reads directly while drawing, which is why this stays in `lib` instead of inside
 * the component: the same traces can be exported frame by frame.
 *
 * Reseeding hashes the index rather than calling `Math.random`, for the reason the
 * emitter layouts use: a tracer field that is random per reload cannot be compared
 * against the frame before it.
 */

export type VelocityField = {
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly width: number;
  readonly height: number;
};

export type ViewWindow = { x: number; y: number; width: number; height: number };

export type TracerOptions = {
  /** Points alive at once. */
  count: number;
  /** Seconds before a tracer retires and respawns elsewhere. */
  life: number;
  /** Streak length, in cells. */
  tail: number;
  /** Below this speed, in cells per second, a tracer dies and respawns. */
  restSpeed: number;
};

export type Tracers = {
  /** Head position, in grid cells. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Where each streak starts, `tail` cells behind the head. */
  readonly tailX: Float32Array;
  readonly tailY: Float32Array;
  /** Seconds since the last respawn. */
  readonly age: Float32Array;
  readonly count: number;
  readonly options: TracerOptions;
  /**
   * Advects by `dt` seconds, then retires the tracers that stalled, died or ran
   * off the grid.
   *
   * `view` is the visible window in grid cells. Spawning inside it rather than
   * over the whole grid matters as soon as the camera zooms: a tracer born outside
   * the view spends its whole life offscreen and the area being looked at stays
   * empty.
   */
  advance: (dt: number, field: VelocityField, view: ViewWindow) => void;
  /** Rebuilds the pool at a new count, discarding positions. */
  resize: (count: number) => void;
  set: (next: Partial<TracerOptions>) => void;
};

export const DEFAULT_TRACERS: TracerOptions = {
  count: 900,
  life: 4.5,
  tail: 14,
  restSpeed: 0.4,
};

/** Steps used to walk a tail backwards along the field. */
const TAIL_STEPS = 6;

export function createTracers(initial: Partial<TracerOptions> = {}): Tracers {
  let options: TracerOptions = { ...DEFAULT_TRACERS, ...defined(initial) };

  let count = 0;
  let x = new Float32Array(0);
  let y = new Float32Array(0);
  let tailX = new Float32Array(0);
  let tailY = new Float32Array(0);
  let age = new Float32Array(0);
  let salt = 0;

  function respawn(i: number, left: number, top: number, spanX: number, spanY: number): void {
    x[i] = left + hash(i * 2 + salt) * spanX;
    y[i] = top + hash(i * 2 + 1 + salt) * spanY;
    tailX[i] = x[i];
    tailY[i] = y[i];
    age[i] = 0;
  }

  function allocate(next: number): void {
    count = Math.max(0, Math.floor(next));
    x = new Float32Array(count);
    y = new Float32Array(count);
    tailX = new Float32Array(count);
    tailY = new Float32Array(count);
    age = new Float32Array(count);
    for (let i = 0; i < count; i++) respawn(i, 0, 0, 1, 1);
  }

  function advance(dt: number, field: VelocityField, view: ViewWindow): void {
    if (count === 0 || dt <= 0) return;

    const lastX = field.width - 1;
    const lastY = field.height - 1;

    // The spawn window is the visible one padded by the streak length, so a tracer
    // born on the far edge still draws a streak instead of a dot appearing whole.
    const left = Math.max(0, view.x - options.tail);
    const top = Math.max(0, view.y - options.tail);
    const spanX = Math.min(field.width, view.x + view.width + options.tail) - left;
    const spanY = Math.min(field.height, view.y + view.height + options.tail) - top;
    if (spanX <= 0 || spanY <= 0) return;

    salt++;

    const restSq = options.restSpeed * options.restSpeed;

    for (let i = 0; i < count; i++) {
      const headX = x[i];
      const headY = y[i];
      const u = sample(field.u, headX, headY, lastX, lastY);
      const v = sample(field.v, headX, headY, lastX, lastY);

      if (u * u + v * v < restSq) {
        respawn(i, left, top, spanX, spanY);
        continue;
      }

      const nextX = headX + u * dt;
      const nextY = headY + v * dt;
      if (nextX < 0 || nextY < 0 || nextX > lastX || nextY > lastY) {
        respawn(i, left, top, spanX, spanY);
        continue;
      }

      const tail = backtrace(field, nextX, nextY, options.tail, lastX, lastY);
      tailX[i] = tail.x;
      tailY[i] = tail.y;
      x[i] = nextX;
      y[i] = nextY;
      age[i] += dt;

      if (age[i] > options.life) respawn(i, left, top, spanX, spanY);
    }
  }

  allocate(options.count);

  return {
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    get tailX() {
      return tailX;
    },
    get tailY() {
      return tailY;
    },
    get age() {
      return age;
    },
    get count() {
      return count;
    },
    get options() {
      return options;
    },
    advance,
    resize(next) {
      const target = Math.max(0, Math.floor(next));
      if (target === count) return;
      options = { ...options, count: target };
      allocate(target);
    },
    set(next) {
      options = { ...options, ...defined(next) };
      if (Math.floor(options.count) !== count) allocate(options.count);
    },
  };
}

/**
 * Walks backwards along the field to find where a streak starts.
 *
 * The walk is a fixed number of steps over a fixed distance rather than one step
 * per frame, so the streak is the same length at 30fps and at 144fps. Velocity is
 * resampled at each step so a streak follows a curve instead of pointing back along
 * the head's velocity, and a cell that has gone still contributes no direction, which
 * is why the last good direction is kept rather than replaced with zero.
 */
function backtrace(
  field: VelocityField,
  headX: number,
  headY: number,
  distance: number,
  lastX: number,
  lastY: number
): { x: number; y: number } {
  const step = distance / TAIL_STEPS;
  let px = headX;
  let py = headY;
  let directionX = -1;
  let directionY = 0;

  for (let s = 0; s < TAIL_STEPS; s++) {
    const u = sample(field.u, px, py, lastX, lastY);
    const v = sample(field.v, px, py, lastX, lastY);
    const speed = Math.hypot(u, v);
    if (speed > 1e-4) {
      directionX = u / speed;
      directionY = v / speed;
    }

    px = clamp(px - directionX * step, 0, lastX);
    py = clamp(py - directionY * step, 0, lastY);
  }

  return { x: px, y: py };
}

function sample(field: Float32Array, x: number, y: number, lastX: number, lastY: number): number {
  const width = lastX + 1;
  const fx = clamp(Math.floor(x), 0, lastX);
  const fy = clamp(Math.floor(y), 0, lastY);
  const fx1 = fx < lastX ? fx + 1 : lastX;
  const fy1 = fy < lastY ? fy + 1 : lastY;
  const tx = clamp(x - fx, 0, 1);
  const ty = clamp(y - fy, 0, 1);
  const rowA = fy * width;
  const rowB = fy1 * width;
  const top = field[rowA + fx] * (1 - tx) + field[rowA + fx1] * tx;
  const bottom = field[rowB + fx] * (1 - tx) + field[rowB + fx1] * tx;
  return top + (bottom - top) * ty;
}

/**
 * Deterministic 0..1 from an integer.
 *
 * The integer is mixed before the shift because consecutive indices seed with a
 * stride of 1, and an unshifted multiply of adjacent integers leaves visible
 * correlation between neighbouring tracers.
 */
function hash(value: number): number {
  let h = (value * 374761393 + 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function defined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}