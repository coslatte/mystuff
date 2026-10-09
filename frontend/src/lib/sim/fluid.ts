/*
 * Stable fluids on a grid.
 *
 * A 2D incompressible fluid, solved on a coarse grid with semi-Lagrangian
 * advection and a Jacobi pressure projection. This is the "core" the user of this
 * page is meant to keep: it has no canvas, no DOM, no React and no colour in it,
 * so the same solver can drive a full-bleed page background, a texture or an
 * export frame without being touched.
 *
 * The classical formulation is Stam's, with vorticity confinement on top. The
 * confinement term is the part that matters visually. A plain projection solver
 * damps curl every step, so a couple of seconds in everything looks like it was
 * stirred once and forgotten. Pushing energy back along the curl gradient is what
 * keeps filaments thin and lets them roll into themselves.
 *
 * Everything is a flat Float32Array at one size, allocated in the constructor.
 * There is no allocation inside `step`, which is what lets a 200x60 field run at
 * sixty frames a second without producing garbage for the collector.
 */

/**
 * Tuning, as live fields rather than constructor arguments.
 *
 * These are read on every step, so a control on the page can change them without
 * rebuilding the solver and losing the field. That is the difference between a
 * knob that animates and a knob that resets.
 */
export type FluidTuning = {
  /** Pressure solver sweeps. */
  iterations: number;
  /**
   * Vorticity confinement strength. The one that matters visually: it is the term
   * that folds the field into filaments and rolls them into each other, and
   * without it the picture is parallel bands that slide past. It is also the term
   * that diverges when mistuned, which is what `maxVelocity` contains.
   */
  vorticity: number;
  /** Velocity retained per second. */
  velocityDamping: number;
  /** Dye retained per second. Lower values let a wash dry out. */
  dyeDamping: number;
  /** Speed below which a cell's velocity is snapped to zero. */
  restVelocity: number;
  /**
   * Hard ceiling on speed, in cells per second.
   *
   * Not a tuning knob. The confinement term is a feedback loop and a mistuned one
   * diverges to Infinity within a few hundred frames; without a ceiling that shows
   * up as a canvas that quietly turns black and never recovers, which is a far
   * worse failure than a slightly less energetic flow.
   */
  maxVelocity: number;
};

/** Only the fields a page is allowed to reach. `maxVelocity` stays private. */
export type FluidControls = Pick<
  FluidTuning,
  "iterations" | "vorticity" | "velocityDamping" | "dyeDamping"
>;

const DEFAULT_TUNING: FluidTuning = {
  iterations: 14,
  vorticity: 140,
  velocityDamping: 0.12,
  dyeDamping: 0.4,
  restVelocity: 0.00004,
  maxVelocity: 260,
};

/** Grid size, plus tuning. Every tuning field is optional and falls back. */
export type FluidConfig = Partial<FluidControls> & {
  /** Grid size in cells. */
  width: number;
  height: number;
  /**
   * How many scalar fields the dye carries.
   *
   * One per pigment, which is what turns a velocity simulation into a paint
   * simulation: each channel is transported by the same velocity but mixed by
   * Kubelka-Munk afterwards, so the solver never needs to know what colour is.
   */
  channels: number;
};

export class FluidSolver {
  readonly width: number;
  readonly height: number;
  readonly channels: number;

  /** Velocity. */
  readonly u: Float32Array;
  readonly v: Float32Array;
  /** Dye: `channels` floats per cell, interleaved across the row. */
  readonly dye: Float32Array;

  iterations: number;
  vorticity: number;
  velocityDamping: number;
  dyeDamping: number;

  private readonly u0: Float32Array;
  private readonly v0: Float32Array;
  private readonly pressure: Float32Array;
  private readonly divergence: Float32Array;
  private readonly curl: Float32Array;

  private readonly restVelocity: number;
  private readonly maxVelocity: number;

  constructor(config: FluidConfig) {
    const tuning: FluidTuning = {
      ...DEFAULT_TUNING,
      ...pickDefined(config),
      iterations: config.iterations ?? DEFAULT_TUNING.iterations,
      vorticity: config.vorticity ?? DEFAULT_TUNING.vorticity,
      velocityDamping: config.velocityDamping ?? DEFAULT_TUNING.velocityDamping,
      dyeDamping: config.dyeDamping ?? DEFAULT_TUNING.dyeDamping,
    };

    this.width = Math.max(2, Math.floor(config.width));
    this.height = Math.max(2, Math.floor(config.height));
    this.channels = Math.max(1, Math.floor(config.channels));

    const cells = this.width * this.height;
    this.u = new Float32Array(cells);
    this.v = new Float32Array(cells);
    this.dye = new Float32Array(cells * this.channels);
    this.u0 = new Float32Array(cells);
    this.v0 = new Float32Array(cells);
    this.pressure = new Float32Array(cells);
    this.divergence = new Float32Array(cells);
    this.curl = new Float32Array(cells);

    this.iterations = tuning.iterations;
    this.vorticity = tuning.vorticity;
    this.velocityDamping = tuning.velocityDamping;
    this.dyeDamping = tuning.dyeDamping;
    this.restVelocity = tuning.restVelocity;
    this.maxVelocity = tuning.maxVelocity;
  }

  /**
   * Applies a partial tuning change without touching the field.
   *
   * Used by the page's controls, which must not restart the simulation every time
   * a slider moves: the picture is the thing being adjusted, and throwing it away
   * on every input would make the control unusable.
   */
  tune(next: FluidControls): void {
    if (next.iterations !== undefined) this.iterations = next.iterations;
    if (next.vorticity !== undefined) this.vorticity = next.vorticity;
    if (next.velocityDamping !== undefined) this.velocityDamping = next.velocityDamping;
    if (next.dyeDamping !== undefined) this.dyeDamping = next.dyeDamping;
  }

  /**
   * Injects velocity as an impulse, in cells per second.
   *
   * Use this for a kick that should decay on its own. For an emitter that should
   * hold a speed, use `setVelocity`: impulses accumulate, so a sustained force
   * left here climbs until the solver destabilises.
   */
  addForce(x: number, y: number, dx: number, dy: number): void {
    this.splat(x, y, this.u, 0, 1, dx);
    this.splat(x, y, this.v, 0, 1, dy);
  }

  /**
   * Drives the local velocity toward a target, in cells per second.
   *
   * This is what an emitter wants: the field reaches `vx` in roughly `1 / rate`
   * seconds and stays there, whatever the damping is doing and whatever the frame
   * rate is. Accumulating an impulse instead makes the speed a function of both,
   * which is how a vent ends up either crawling or blowing the solver up.
   *
   * `rate` is how aggressively it converges, in 1/seconds.
   */
  setVelocity(x: number, y: number, vx: number, vy: number, rate: number, dt: number): void {
    const k = 1 - Math.exp(-Math.max(0, rate) * dt);
    if (k <= 0) return;
    this.splatToward(x, y, this.u, vx, k);
    this.splatToward(x, y, this.v, vy, k);
  }

  /**
   * Drives a soft disc of the field toward a target velocity, in cells per second.
   *
   * The pointer's gesture is an area, not a point: a finger or a mouse reports one
   * coordinate, and pushing the single cell under it produces a narrow needle that
   * the projection solver tears apart within a frame. A disc with a smoothstep
   * falloff pushes a patch, and the patch is what carries.
   *
   * Like `setVelocity` this relaxes toward the target rather than adding an impulse,
   * so the same gesture held in one place settles at a speed instead of climbing
   * until the ceiling catches it.
   */
  drive(x: number, y: number, vx: number, vy: number, radius: number, rate: number, dt: number): void {
    const k = 1 - Math.exp(-Math.max(0, rate) * dt);
    if (k <= 0 || radius <= 0) return;

    const { width, height, u, v } = this;
    const minX = Math.max(0, Math.floor(x - radius));
    const maxX = Math.min(width - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius));
    const maxY = Math.min(height - 1, Math.ceil(y + radius));
    const radiusSq = radius * radius;

    for (let py = minY; py <= maxY; py++) {
      const dy = py - y;
      const dySq = dy * dy;
      for (let px = minX; px <= maxX; px++) {
        const dx = px - x;
        const distanceSq = dx * dx + dySq;
        if (distanceSq > radiusSq) continue;

        const normalized = Math.sqrt(distanceSq) / radius;
        const weight = k * (1 - normalized * normalized * (3 - 2 * normalized));
        const i = py * width + px;
        u[i] += (vx - u[i]) * weight;
        v[i] += (vy - v[i]) * weight;
      }
    }
  }

  /** Injects dye over a soft disc. The area counterpart of `addDye`. */
  addDyeArea(x: number, y: number, amounts: ArrayLike<number>, radius: number, strength = 1): void {
    if (radius <= 0) return;

    const { width, height, channels, dye } = this;
    const minX = Math.max(0, Math.floor(x - radius));
    const maxX = Math.min(width - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius));
    const maxY = Math.min(height - 1, Math.ceil(y + radius));
    const radiusSq = radius * radius;

    for (let py = minY; py <= maxY; py++) {
      const dy = py - y;
      const dySq = dy * dy;
      for (let px = minX; px <= maxX; px++) {
        const dx = px - x;
        const distanceSq = dx * dx + dySq;
        if (distanceSq > radiusSq) continue;

        const normalized = Math.sqrt(distanceSq) / radius;
        const weight = (1 - normalized * normalized * (3 - 2 * normalized)) * strength;
        const base = (py * width + px) * channels;
        for (let c = 0; c < channels; c++) dye[base + c] += (amounts[c] ?? 0) * weight;
      }
    }
  }

  /** Bilinear write into an interleaved or scalar field. */
  private splat(x: number, y: number, field: Float32Array, channel: number, stride: number, value: number): void {
    const { width, height } = this;
    const [cx0, cx1, wx0, wx1] = corners(x, width);
    const [cy0, cy1, wy0, wy1] = corners(y, height);

    field[(cy0 * width + cx0) * stride + channel] += value * wx0 * wy0;
    field[(cy0 * width + cx1) * stride + channel] += value * wx1 * wy0;
    field[(cy1 * width + cx0) * stride + channel] += value * wx0 * wy1;
    field[(cy1 * width + cx1) * stride + channel] += value * wx1 * wy1;
  }

  /** Bilinear write that moves each cell a fraction of the way to `target`. */
  private splatToward(x: number, y: number, field: Float32Array, target: number, k: number): void {
    const { width, height } = this;
    const [cx0, cx1, wx0, wx1] = corners(x, width);
    const [cy0, cy1, wy0, wy1] = corners(y, height);

    field[cy0 * width + cx0] += (target - field[cy0 * width + cx0]) * wx0 * wy0 * k;
    field[cy0 * width + cx1] += (target - field[cy0 * width + cx1]) * wx1 * wy0 * k;
    field[cy1 * width + cx0] += (target - field[cy1 * width + cx0]) * wx0 * wy1 * k;
    field[cy1 * width + cx1] += (target - field[cy1 * width + cx1]) * wx1 * wy1 * k;
  }

  /**
   * Advances the field by one step.
   *
   * `dt` is a multiplier, not a wall-clock delta: the caller clamps it so a
   * background tab or a long GC pause cannot integrate a huge jump and blow the
   * solver up. The order is the standard one, and vorticity is computed before
   * the projection that consumes it.
   */
  step(dt: number): void {
    this.confineVorticity(dt);
    this.project();
    this.advectVelocity(dt);
    this.project();
    this.applyDamping(dt);
    this.advectDye(dt);
    this.applyDyeDamping(dt);
  }

  /** Bilinear sample of a scalar field at fractional cell coordinates. */
  sample(field: Float32Array, x: number, y: number): number {
    const { width, height } = this;
    const x0 = clamp(Math.floor(x), 0, width - 1);
    const y0 = clamp(Math.floor(y), 0, height - 1);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const tx = clamp(x - x0, 0, 1);
    const ty = clamp(y - y0, 0, 1);

    const top = field[y0 * width + x0] * (1 - tx) + field[y0 * width + x1] * tx;
    const bottom = field[y1 * width + x0] * (1 - tx) + field[y1 * width + x1] * tx;
    return top + (bottom - top) * ty;
  }

  /** Injects dye at a fractional cell position, one value per channel. */
  addDye(x: number, y: number, amounts: ArrayLike<number>): void {
    for (let c = 0; c < this.channels; c++) {
      this.splat(x, y, this.dye, c, this.channels, amounts[c] ?? 0);
    }
  }

  /** Removes dye at a fractional cell position. This is what a dry brush does. */
  removeDye(x: number, y: number, amount: number): void {
    const base = (Math.floor(y) * this.width + Math.floor(x)) * this.channels;
    if (base < 0 || base >= this.dye.length) return;
    for (let c = 0; c < this.channels; c++) this.dye[base + c] *= 1 - amount;
  }

  /**
   * Pushes energy back along the curl gradient.
   *
   * Reads `curl` for every cell, then adds a force perpendicular to that gradient
   * scaled by the curl itself, so cells that are already rotating get pushed and
   * cells that are not get left alone. Without this the solver loses swirl energy
   * to numerical damping every step and the whole field goes flat within seconds.
   *
   * Every neighbour lookup is clamped. The obvious `field[(y - 1) * width + x]`
   * walks off the front of the array on the first row, and one `undefined` there
   * propagates through the whole field as NaN within a frame.
   */
  private confineVorticity(dt: number): void {
    const { width, height, u, v, curl } = this;
    const strength = this.vorticity * dt;

    for (let y = 0; y < height; y++) {
      const above = Math.max(0, y - 1);
      const below = Math.min(height - 1, y + 1);
      const row = y * width;
      const rowUp = above * width;
      const rowDown = below * width;

      for (let x = 0; x < width; x++) {
        const left = x > 0 ? x - 1 : 0;
        const right = x < width - 1 ? x + 1 : width - 1;
        curl[row + x] = (v[row + left] - v[row + right] + u[rowUp + x] - u[rowDown + x]) * 0.5;
      }
    }

    if (strength === 0) return;

    for (let y = 0; y < height; y++) {
      const row = y * width;
      const rowUp = Math.max(0, y - 1) * width;
      const rowDown = Math.min(height - 1, y + 1) * width;

      for (let x = 0; x < width; x++) {
        const i = row + x;
        const rotation = curl[i];
        if (rotation === 0) continue;

        const left = x > 0 ? x - 1 : 0;
        const right = x < width - 1 ? x + 1 : width - 1;
        const gradX = Math.abs(curl[row + right]) - Math.abs(curl[row + left]);
        const gradY = Math.abs(curl[rowDown + x]) - Math.abs(curl[rowUp + x]);
        const length = Math.sqrt(gradX * gradX + gradY * gradY) + 1e-5;

        u[i] += (strength * gradY * rotation) / length;
        v[i] -= (strength * gradX * rotation) / length;
      }
    }
  }

  /**
   * Makes the field divergence free by solving for pressure and subtracting its
   * gradient. This is the incompressibility half of the solver: without it the
   * flow compresses into blobs instead of circulating.
   */
  private project(): void {
    const { width, height, u, v, pressure, divergence } = this;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = index(x, y, width);
        const left = x > 0 ? u[i - 1] : 0;
        const right = x < width - 1 ? u[i + 1] : 0;
        const down = y > 0 ? v[i - width] : 0;
        const up = y < height - 1 ? v[i + width] : 0;
        divergence[i] = -0.5 * (right - left + up - down);
        pressure[i] = 0;
      }
    }

    for (let pass = 0; pass < this.iterations; pass++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = index(x, y, width);
          const left = x > 0 ? pressure[i - 1] : pressure[i];
          const right = x < width - 1 ? pressure[i + 1] : pressure[i];
          const down = y > 0 ? pressure[i - width] : pressure[i];
          const up = y < height - 1 ? pressure[i + width] : pressure[i];
          pressure[i] = (divergence[i] + left + right + down + up) * 0.25;
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = index(x, y, width);
        const left = x > 0 ? pressure[i - 1] : pressure[i];
        const right = x < width - 1 ? pressure[i + 1] : pressure[i];
        const down = y > 0 ? pressure[i - width] : pressure[i];
        const up = y < height - 1 ? pressure[i + width] : pressure[i];
        u[i] -= 0.5 * (right - left);
        v[i] -= 0.5 * (up - down);
      }
    }
  }

  private advectVelocity(dt: number): void {
    // Both components are transported from the same snapshot, and each one is
    // written into a scratch buffer rather than over itself. Semi-Lagrangian
    // transport is only correct when the destination is a different array: a cell
    // traces back to a neighbour that may already have been overwritten by the
    // time the scan reaches it, which smears the field toward whichever edge the
    // scan runs from. On a wide board that reads as the whole picture sliding into
    // one corner.
    this.u0.set(this.u);
    this.v0.set(this.v);
    this.transport(this.u, this.u0, dt);
    this.transport(this.v, this.v0, dt);
    this.u.set(this.u0);
    this.v.set(this.v0);
    this.freeSlipBoundary();
  }

  /**
   * Semi-Lagrangian transport of one scalar field: each cell looks up where its
   * contents came from.
   *
   * Unconditionally stable, which is why the timestep does not have to be small.
   * The cost is numerical diffusion, and that is precisely what the vorticity term
   * exists to pay back.
   *
   * The bilinear lookups are written out inline rather than calling `sample`, and
   * that is a measured decision rather than a style one. Routing four lookups per
   * cell through a shared method with a bounds clamp in each cost 19.7ms for this
   * field alone, about a third of the frame; inlined it is roughly two.
   */
  private transport(src: Float32Array, dst: Float32Array, dt: number): void {
    const { width, height, u, v } = this;
    const lastX = width - 1;
    const lastY = height - 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Forward sample of the velocity field at this cell's centre. The centre
        // is always inside the grid, so the only bounds work is the right and
        // bottom edges.
        const sx = x + 0.5;
        const sy = y + 0.5;
        const fx = sx | 0;
        const fy = sy | 0;
        const tx = sx - fx;
        const ty = sy - fy;
        const fx1 = fx < lastX ? fx + 1 : lastX;
        const fy1 = fy < lastY ? fy + 1 : lastY;
        const rowA = fy * width;
        const rowB = fy1 * width;

        const topU = u[rowA + fx] + (u[rowA + fx1] - u[rowA + fx]) * tx;
        const botU = u[rowB + fx] + (u[rowB + fx1] - u[rowB + fx]) * tx;
        const topV = v[rowA + fx] + (v[rowA + fx1] - v[rowA + fx]) * tx;
        const botV = v[rowB + fx] + (v[rowB + fx1] - v[rowB + fx]) * tx;

        let backX = sx - (topU + (botU - topU) * ty) * dt;
        let backY = sy - (topV + (botV - topV) * ty) * dt;
        if (backX < 0) backX = 0;
        else if (backX > lastX + 0.5) backX = lastX + 0.5;
        if (backY < 0) backY = 0;
        else if (backY > lastY + 0.5) backY = lastY + 0.5;

        const bx = backX | 0;
        const by = backY | 0;
        const ux = backX - bx;
        const uy = backY - by;
        const ix = 1 - ux;
        const iy = 1 - uy;
        const bx1 = bx < lastX ? bx + 1 : lastX;
        const by1 = by < lastY ? by + 1 : lastY;
        const srcA = by * width;
        const srcB = by1 * width;

        const p00 = src[srcA + bx];
        const p10 = src[srcA + bx1];
        const p01 = src[srcB + bx];
        const p11 = src[srcB + bx1];
        dst[y * width + x] = (p00 * ix + p10 * ux) * iy + (p01 * ix + p11 * ux) * uy;
      }
    }
  }

  private advectDye(dt: number): void {
    const { width, height, channels, u, v, dye } = this;
    if (this.dyeScratch.length !== dye.length) this.dyeScratch = new Float32Array(dye.length);
    const scratch = this.dyeScratch;
    scratch.set(dye);

    const lastX = width - 1;
    const lastY = height - 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sx = x + 0.5;
        const sy = y + 0.5;
        const fx = sx | 0;
        const fy = sy | 0;
        const tx = sx - fx;
        const ty = sy - fy;
        const fx1 = fx < lastX ? fx + 1 : lastX;
        const fy1 = fy < lastY ? fy + 1 : lastY;
        const rowA = fy * width;
        const rowB = fy1 * width;

        const topU = u[rowA + fx] + (u[rowA + fx1] - u[rowA + fx]) * tx;
        const botU = u[rowB + fx] + (u[rowB + fx1] - u[rowB + fx]) * tx;
        const topV = v[rowA + fx] + (v[rowA + fx1] - v[rowA + fx]) * tx;
        const botV = v[rowB + fx] + (v[rowB + fx1] - v[rowB + fx]) * tx;

        let backX = sx - (topU + (botU - topU) * ty) * dt;
        let backY = sy - (topV + (botV - topV) * ty) * dt;
        if (backX < 0) backX = 0;
        else if (backX > lastX + 0.5) backX = lastX + 0.5;
        if (backY < 0) backY = 0;
        else if (backY > lastY + 0.5) backY = lastY + 0.5;

        const bx = backX | 0;
        const by = backY | 0;
        const ux = backX - bx;
        const uy = backY - by;
        const ix = 1 - ux;
        const iy = 1 - uy;
        // Clamped explicitly. `srcA + 1` would wrap into the next row whenever the
        // trace lands on the last column, which is a different cell entirely and
        // shows up as a seam down the right-hand edge.
        const bx1 = bx < lastX ? bx + 1 : lastX;
        const by1 = by < lastY ? by + 1 : lastY;
        // The four corner cells, each clamped to the grid.
        const srcA = by * width + bx;
        const srcB = by * width + bx1;
        const srcC = by1 * width + bx;
        const srcD = by1 * width + bx1;
        const out = (y * width + x) * channels;

        // One set of weights for the whole channel block. Reading four corners
        // per channel, as a naive port would, quadruples the loads for no reason.
        for (let c = 0; c < channels; c++) {
          const top = scratch[srcA * channels + c] * ix + scratch[srcB * channels + c] * ux;
          const bottom = scratch[srcC * channels + c] * ix + scratch[srcD * channels + c] * ux;
          dye[out + c] = top * iy + bottom * uy;
        }
      }
    }
  }

  private dyeScratch = new Float32Array(0);

  private applyDamping(dt: number): void {
    const decay = Math.exp(this.velocityDamping * dt);
    const rest = this.restVelocity;
    const ceiling = this.maxVelocity;
    const { u, v } = this;
    for (let i = 0; i < u.length; i++) {
      // One pass does the damping, the near-zero snap, the ceiling and the
      // non-finite scrub. They are all per-cell and all O(1), and splitting them
      // into separate loops would mean four traversals of the field for no gain.
      let nextU = u[i] * decay;
      let nextV = v[i] * decay;

      // Snapping the near-still cells stops a faint residual drift from
      // accumulating into a slow current that pushes everything off one edge.
      if (nextU > -rest && nextU < rest) nextU = 0;
      if (nextV > -rest && nextV < rest) nextV = 0;

      if (nextU > ceiling) nextU = ceiling;
      else if (nextU < -ceiling) nextU = -ceiling;
      if (nextV > ceiling) nextV = ceiling;
      else if (nextV < -ceiling) nextV = -ceiling;

      u[i] = Number.isFinite(nextU) ? nextU : 0;
      v[i] = Number.isFinite(nextV) ? nextV : 0;
    }
  }

  private applyDyeDamping(dt: number): void {
    const decay = Math.exp(-this.dyeDamping * dt);
    const dye = this.dye;
    for (let i = 0; i < dye.length; i++) {
      const value = dye[i] * decay;
      dye[i] = Number.isFinite(value) && value > 0 ? (value > 1 ? 1 : value) : 0;
    }
  }

  /**
   * Free-slip walls: the component of velocity crossing each edge is cancelled
   * and the component running along it is left alone.
   *
   * The normal to a horizontal wall is vertical and the normal to a vertical wall
   * is horizontal, so the top and bottom rows lose `v` and the left and right
   * columns lose `u`. Cancelling the tangential component instead, which is the
   * easier mistake to make and looks correct at a glance, freezes the flow along
   * those two edges: on a short wide board that is most of the visible field, and
   * the pigment never reaches the bottom of the picture at all.
   *
   * Cancelling both components would be worse: a still band along every edge,
   * instead of a still line.
   */
  private freeSlipBoundary(): void {
    const { width, height, u, v } = this;
    const lastX = width - 1;
    const lastY = height - 1;

    for (let x = 0; x < width; x++) {
      v[x] = 0;
      v[lastY * width + x] = 0;
    }
    for (let y = 0; y < height; y++) {
      u[y * width] = 0;
      u[y * width + lastX] = 0;
    }
  }
}

function index(x: number, y: number, width: number): number {
  return y * width + x;
}

/**
 * Bilinear splat corners and weights for a fractional cell position.
 *
 * Returns `[low, high, lowWeight, highWeight]` with both indices inside the grid
 * and both weights summing to one.
 *
 * Cell `i` has its centre at `i + 0.5`, which is the convention `transport` uses
 * when it samples the velocity at a cell centre, so the cell index here is
 * `floor(position)` and not `floor(position - 0.5)`. Getting that half-cell wrong
 * does not look like an error: every emitter is simply half a cell off, which at
 * this grid size is invisible on its own and compounds into a visible bias once
 * the flow starts pooling against an edge.
 *
 * Doing the clamping here rather than at each of the four write sites is what
 * keeps a splat off the front of the array when the position is near an edge.
 */
function corners(position: number, size: number): [number, number, number, number] {
  const low = Math.floor(position);
  const high = low + 1;
  const t = position - low;

  const clampedLow = low < 0 ? 0 : low > size - 1 ? size - 1 : low;
  const clampedHigh = high < 0 ? 0 : high > size - 1 ? size - 1 : high;

  // Off the low edge the mass all belongs to the clamped cell, and off the high
  // edge it all belongs to the other one. Without this the weights stop summing to
  // one and every emission near a border quietly gains or loses pigment.
  const lowWeight = high > size - 1 ? 0 : low < 0 ? 0 : t > 1 ? 1 : t;
  const highWeight = low < 0 ? 1 : 1 - lowWeight;

  return [clampedLow, clampedHigh, lowWeight, highWeight];
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function pickDefined<T extends object>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}