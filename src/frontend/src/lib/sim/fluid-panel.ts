/*
 * The ink behind the `/` about panel.
 *
 * `FluidSolver` carries no colour, so this module is the only place that decides
 * what the field looks like: the three dye channels give one density and one hue,
 * and the pair is composited over the paper. The Kubelka-Munk mixing belongs to
 * `/experimentation/spectral`, and a second pigment simulation on the home page
 * would show the same picture twice.
 *
 * The grid is fixed on purpose. Resizing the solver throws the field away, so the
 * canvas scales its own backing store for free and the field keeps its cells.
 */

import { FluidSolver } from "./fluid";
import { applyNoiseAndGain, drawHalftone } from "./fluid-filters";

type RGB = readonly [number, number, number];

/**
 * Grid for a panel that is taller than it is wide.
 *
 * The field is stretched to the canvas by `drawImage`, so the grid's aspect is the
 * aspect of the picture: a band-shaped grid behind a portrait panel smears every
 * plume three times vertically. Cells stay roughly square at the panel's size.
 */
const WIDTH = 112;
const HEIGHT = 132;

/** Simulated seconds run before the first paint, so the opening frame is a
 *  developed picture and not a drop of ink on an empty board. */
const SETTLE_SECONDS = 3;

const STEP = 1 / 30;

/** Matches the loading painters. Thirty frames buys everything this band needs. */
const FRAME_MS = 1000 / 30;

/**
 * Scales a hue back up off the simplex.
 *
 * Normalizing puts every hue on the simplex, where the components sum to one and
 * no real colour can sit on it, so the display multiplies back out. Two tints share
 * one constant because both are theme tokens that already sum to more than one.
 */
const EXPOSURE = 1.2;

/**
 * How fast total dye becomes darkness.
 *
 * This is a display curve and it has to stay gentle. Steep enough to rescue a faint
 * picture, it pins most of the panel at full alpha, and a field with no headroom
 * cannot show the pointer moving dye through it: swapping saturated ink around
 * renders identically. Visibility comes from the dose, not from the curve.
 */
const DENSITY = 5;

/**
 * Per step.
 *
 * High because the sources inject over a disc far larger than the panel, so per-cell
 * dye is small. Low enough that the plume fades on the way up rather than arriving as
 * a wall of colour.
 */
const DYE_PER_STEP = 0.22;

/**
 * In cells, not scaled by the display size: a radius that shrinks with the viewport
 * is invisible on a wide panel and huge on a phone, and the field is what the gesture
 * has to move. It has to be wide against the sources too — they drive every cell near
 * the bottom continuously, and a narrow disc simply loses to them.
 */
const POINTER_RADIUS = 16;
const POINTER_SPEED = 220;

/**
 * Source positions on a low-discrepancy sequence.
 *
 * Evenly spaced sources read as a printed pattern; evenly jittered ones clump.
 * The golden-ratio sequence is well spread and irregular by construction, and it
 * needs no generator and no seed, so the composition is the same on every load.
 */
const PHI = 0.6180339887;
const fract = (n: number) => n - Math.floor(n);

const SOURCE_COUNT = 5;

const SOURCES = Array.from({ length: SOURCE_COUNT }, (_, index) => ({
  x: fract(0.5 + index * PHI) * WIDTH,
  speed: 0.75 + fract(0.21 + index * PHI * 2.3) * 0.7,
  drift: fract(0.77 + index * PHI * 1.7) > 0.5 ? 1 : -1,
  tint: (index % 2 === 1 ? "red" : "blue") as "blue" | "red",
}));

/**
 * Well below the bottom edge, so no source is ever visible as a blob.
 *
 * `freeSlipBoundary` cancels the velocity crossing each wall, so the disc cannot be
 * pushed past the edge and still reach — the radius is what spans the gap. Moving the
 * centre and the radius together is the whole trick: the peak stays far outside, so
 * everything inside the grid sits on the outer skirt of the falloff and the ink
 * enters graded instead of as a hard band along the edge.
 */
const SOURCE_Y = HEIGHT + 20;

/** Cells per second, before each source's own multiplier. */
const SOURCE_SPEED = 70;

/** Convergence of the forcing, in 1/seconds. */
const SOURCE_RATE = 3;

const SOURCE_RADIUS = 27;
const DYE_RADIUS = 26;

/**
 * Cells of fade at every edge of the canvas, so a cut of the canvas can never show
 * as a hard rectangle and the ink arrives from nowhere at the borders.
 *
 * Sized to roughly the bleed, not to a rounded vignette: wider and the ink fades out
 * before it reaches the panel's own border, which is the one place the escape is
 * supposed to be visible.
 */
const EDGE_FADE = 6;


export function mountFluidPanel(canvas: HTMLCanvasElement): () => void {
  const found = canvas.getContext("2d");
  if (!found) return () => {};
  const context: CanvasRenderingContext2D = found;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const solver = new FluidSolver({
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    // Half the lab default: on a decorative panel the pressure solve is the dominant
    // cost and the difference is not visible at this size.
    iterations: 8,
    // Light on purpose. The confinement term is what folds a plume into filaments,
    // and past roughly this the panel reads as churn instead of a flow travelling up.
    vorticity: 40,
    // What decides how far the ink gets: a plume needs about two seconds to cross the
    // panel, and this is what is left of it after the trip.
    dyeDamping: 0.4,
  });

  const styles = getComputedStyle(canvas);
  const paper = readColor(styles.getPropertyValue("--color-brut-bg"));
  const tints: Record<(typeof SOURCES)[number]["tint"], RGB> = {
    blue: simplex(readColor(styles.getPropertyValue("--color-brut-blue"))),
    red: simplex(readColor(styles.getPropertyValue("--color-brut-red"))),
  };

  const field = document.createElement("canvas");
  field.width = WIDTH;
  field.height = HEIGHT;
  const fieldContext = field.getContext("2d");
  if (!fieldContext) return () => {};
  const image = fieldContext.createImageData(WIDTH, HEIGHT);

  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0, y: 0, px: 0, py: 0, active: false };

  let raf = 0;
  let last = 0;
  let lastPaint = -Infinity;
  let onScreen = false;
  let elapsed = 0;

  function emit(elapsed: number, dt: number): void {
    for (const source of SOURCES) {
      // A slow lateral wobble. Fixed sources settle into a still arrangement, and a
      // picture that has stopped rearranging itself reads as a photograph.
      const x = source.x + Math.sin(elapsed * 0.5 + source.x * 0.05) * 5;
      solver.drive(
        x,
        SOURCE_Y,
        // A lateral component, alternating: two plumes travelling the same way make
        // one band, and five of them make two.
        source.drift * (8 + 6 * source.speed),
        -SOURCE_SPEED * source.speed,
        SOURCE_RADIUS,
        SOURCE_RATE,
        dt
      );
      solver.addDyeArea(x, SOURCE_Y, tints[source.tint], DYE_RADIUS, DYE_PER_STEP);
    }
  }

  function stir(dt: number): void {
    if (!pointer.active) return;
    const dx = pointer.x - pointer.px;
    const dy = pointer.y - pointer.py;
    const reach = Math.hypot(dx, dy);
    if (reach < 0.01) return;
    // The gesture sets the direction and the speed is fixed, so the force does not
    // depend on how fast the visitor's hand happens to be moving.
    solver.drive(
      pointer.x,
      pointer.y,
      (dx / reach) * POINTER_SPEED,
      (dy / reach) * POINTER_SPEED,
      // A disc, not the single cell under the pointer: see `drive` on why a needle
      // is torn apart by the projection within a frame.
      POINTER_RADIUS,
      6,
      dt
    );
  }

  // Arrow, not a declaration: a hoisted declaration loses the null check above as
  // far as TypeScript is concerned, and widens `fieldContext` back to `| null`.
  const paint = (): void => {
    const { dye } = solver;
    const pixels = image.data;
    for (let i = 0, p = 0, cell = 0; i < dye.length; i += 3, p += 4) {
      const total = dye[i] + dye[i + 1] + dye[i + 2];
      // Alpha carries the density, so the canvas can be larger than the panel it sits
      // in. Painting opaque paper instead would lay a cream rectangle over the
      // neighbouring column; painting ink lets the edges past the border fade into
      // whatever is behind them, which is the whole point of the bleed.
      const x = cell % WIDTH;
      const y = (cell - x) / WIDTH;
      const edge = Math.min(Math.min(x, WIDTH - 1 - x), Math.min(y, HEIGHT - 1 - y)) / EDGE_FADE;
      const veil = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
      cell += 1;

      const density = total <= 0 ? 0 : (1 - Math.exp(-total * DENSITY)) * veil;
      const share = total <= 0 ? 0 : 1 / total;
      const gain = applyNoiseAndGain(density, x, y);
      for (let c = 0; c < 3; c += 1) {
        pixels[p + c] = mix(paper[c], dye[i + c] * share * EXPOSURE, gain) * 255;
      }
      pixels[p + 3] = Math.round(gain * 255);
    }
    fieldContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(field, 0, 0, WIDTH, HEIGHT, 0, 0, canvas.width, canvas.height);
    drawHalftone(context, canvas.width, canvas.height);
  };

  function canRun(): boolean {
    return onScreen && !document.hidden && !preference.matches;
  }

  function frame(now: number): void {
    raf = 0;
    if (!canRun()) return;
    if (now - lastPaint >= FRAME_MS) {
      // `last` moves here and not on every rAF. Measuring against the previous
      // animation frame hands the solver the display's frame interval, which on a
      // 120Hz screen is a quarter of the step it is supposed to advance. The
      // sources inject per step and the damping is per second, so the two drift
      // apart and the panel silts up with dye.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      lastPaint = now;
      elapsed += dt;
      emit(elapsed, dt);
      stir(dt);
      solver.step(dt);
      paint();
      pointer.px = pointer.x;
      pointer.py = pointer.y;
    }
    raf = requestAnimationFrame(frame);
  }

  function resume(): void {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!canRun()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect();
    if (box.width < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(box.width * dpr));
    const height = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    paint();
  }

  function toGrid(event: PointerEvent): void {
    const box = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - box.left) / Math.max(1, box.width)) * WIDTH;
    pointer.y = ((event.clientY - box.top) / Math.max(1, box.height)) * HEIGHT;
    pointer.active = true;
  }

  const onDown = (event: PointerEvent): void => {
    canvas.setPointerCapture(event.pointerId);
    toGrid(event);
    pointer.px = pointer.x;
    pointer.py = pointer.y;
  };
  const onMove = (event: PointerEvent): void => toGrid(event);
  const onUp = (): void => {
    pointer.active = false;
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onUp);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const visibility = new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      resume();
    },
    { rootMargin: "200px" }
  );
  visibility.observe(canvas);

  const onVisibility = (): void => resume();
  document.addEventListener("visibilitychange", onVisibility);
  preference.addEventListener("change", resume);

  // Runs whether or not motion is welcome, so a reduced-motion visitor gets the
  // settled picture instead of an empty band. It is also the only paint that does
  // not wait for the element to be on screen.
  for (let step = 0; step < SETTLE_SECONDS / STEP; step += 1) {
    elapsed += STEP;
    emit(elapsed, STEP);
    solver.step(STEP);
  }
  paint();
  resume();

  return () => {
    cancelAnimationFrame(raf);
    visibility.disconnect();
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    preference.removeEventListener("change", resume);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onUp);
  };
}

/** Resolves any colour the browser understands to components, through a probe pixel. */
function readColor(value: string): RGB {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const context = probe.getContext("2d");
  if (!context) return [0, 0, 0];
  context.fillStyle = value.trim() || "#000";
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

function simplex(color: RGB): RGB {
  const sum = color[0] + color[1] + color[2];
  if (sum <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [color[0] / sum, color[1] / sum, color[2] / sum];
}

function mix(from: number, to: number, amount: number): number {
  const value = from + (to - from) * amount;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
