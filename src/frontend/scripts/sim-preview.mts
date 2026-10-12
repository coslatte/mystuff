/*
 * Renders the shipped simulation to a PNG contact sheet.
 *
 * Verification only; not part of the site bundle. Run with:
 *   bun run sim-preview.mts [out.png]
 *
 * Every attempt to tune this simulation by statistics produced a number that
 * improved while the picture stayed broken, so the picture is what gets checked.
 */

import { writeFileSync } from "node:fs";

// `PaintSurface` allocates its output through the browser `ImageData`
// constructor. Bun has no canvas, so the same shape is provided here. It is the
// only thing standing between the solver and a headless preview.
(globalThis as unknown as { ImageData: unknown }).ImageData = class {
  colorSpace = "srgb";
  data: Uint8ClampedArray;
  constructor(
    public width: number,
    public height: number
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
};

import { buildPalette, colorFor } from "../src/lib/color-theory";
import { makePigment } from "../src/lib/pigment-math";
import { createPigmentSimulation } from "../src/lib/sim/pigment-sim";
import type { PigmentSimulation } from "../src/lib/sim/pigment-sim";
import { LAYOUTS, LAYOUT_NAMES } from "../src/lib/sim/layouts";
import { createCamera, viewRect } from "../src/lib/sim/camera";
import { writeFieldView, type FieldViewMode } from "../src/lib/sim/field-view";
import { createTracers } from "../src/lib/sim/tracers";
import { PRESETS, applyPreset, DEFAULT_SETTINGS, type SettingsPatch } from "../src/lib/pigment-settings";
import { blit, encodePng, flatten, upscale, type Pixels } from "./png";

const W = 300;
const H = 300;
const SCALE = 2;
const GAP = 8;

/**
 * Grid for the layer sheets.
 *
 * Half the core resolution on purpose. These tiles check the shape of relief, of an
 * overlay ramp and of a camera crop, none of which depend on filament detail, and a
 * 300x300 board costs about a second a simulated second. They are upscaled to the
 * same tile size so the sheet stays one grid, and the blur is what tells you at a
 * glance that they are the cheaper ones.
 */
const LAB = W / 2;
const LAB_SECONDS = 8;

/**
 * `SIM_LAB_ONLY=1` skips the core sheet.
 *
 * The core tiles cost about five minutes and have not changed; the layer tiles cost
 * about thirty seconds and change every time one of those modules is touched.
 */
const LAB_ONLY = process.env.SIM_LAB_ONLY === "1";

/** Seconds of simulated time each core tile is allowed to settle. */
const SECONDS = [6, 20];

function run(settings: SettingsPatch & { layout?: string; width?: number }) {
  const resolved = { ...settings, layout: (settings.layout ?? DEFAULT_SETTINGS.layout) as keyof typeof LAYOUTS };
  const size = resolved.width ?? W;
  const palette = buildPalette({
    hue: (resolved.hue ?? DEFAULT_SETTINGS.hue) + (resolved.seed ?? 0) * 47,
    harmony: resolved.harmony ?? DEFAULT_SETTINGS.harmony,
    chroma: resolved.chroma ?? DEFAULT_SETTINGS.chroma,
    spread: resolved.spread ?? DEFAULT_SETTINGS.spread,
    ramp: resolved.ramp ?? DEFAULT_SETTINGS.ramp,
    count: 4,
  });
  const pigments = palette.hex.map((hex) => makePigment(colorFor(hex), 1, 1));
  const simulation = createPigmentSimulation({ pigments, layout: LAYOUTS[resolved.layout] });
  simulation.resize(size, size);
  simulation.setFlow({
    heading: resolved.heading ?? 0,
    vorticity: resolved.turbulence ?? DEFAULT_SETTINGS.turbulence,
    speed: resolved.speed ?? DEFAULT_SETTINGS.speed,
    density: resolved.density ?? DEFAULT_SETTINGS.density,
    sweep: resolved.sweep ?? DEFAULT_SETTINGS.sweep,
    dyeDamping: resolved.wash ?? DEFAULT_SETTINGS.wash,
    iterations: resolved.iterations ?? DEFAULT_SETTINGS.iterations,
    velocityDamping: resolved.velocityDamping ?? DEFAULT_SETTINGS.velocityDamping,
  });
  simulation.surface.setRelief(resolved.relief ?? 0);
  return simulation;
}

function simulate(simulation: PigmentSimulation, seconds: number): void {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) simulation.advance(1 / 60);
  simulation.paint();
}

function render(palette: ReturnType<typeof buildPalette>, layout: string, seconds: number) {
  const pigments = palette.hex.map((hex) => makePigment(colorFor(hex), 1, 1));
  const simulation = createPigmentSimulation({
    pigments,
    layout: LAYOUTS[layout as keyof typeof LAYOUTS],
  });
  simulation.resize(W, H);
  simulate(simulation, seconds);
  return simulation.surface.image.data;
}

/** Crops a grid-sized RGBA buffer to the window the camera is showing. */
function crop(data: Pixels, width: number, height: number, zoom: number, centreX = 0.5, centreY = 0.5) {
  const base = createCamera(zoom);
  const view = viewRect({ ...base, cx: base.cx + (centreX - 0.5), cy: base.cy + (centreY - 0.5) }, {
    gridWidth: width,
    gridHeight: height,
    boardWidth: W,
    boardHeight: H,
  });
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(height - 1, Math.max(0, Math.round(view.y + (y / H) * view.height)));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(width - 1, Math.max(0, Math.round(view.x + (x / W) * view.width)));
      const from = (sy * width + sx) * 4;
      const to = (y * W + x) * 4;
      out[to] = data[from];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from + 2];
      out[to + 3] = 255;
    }
  }
  return out;
}

/** Nearest-neighbour blow-up of a grid buffer to the sheet's working size. */
function expand(data: Pixels, size: number): Pixels {
  return upscale(data, size, size, W / size).data;
}

/** Draws tracer streaks into an RGBA tile, the same lines the component strokes. */
function withTracers(simulation: PigmentSimulation, base: Pixels, count: number, tail: number): Pixels {
  const tracers = createTracers({ count, tail, life: 1e6 });
  const field = simulation.field;
  const view = { x: 0, y: 0, width: simulation.width, height: simulation.height };

  for (let step = 0; step < 60; step++) {
    tracers.advance(1 / 60, field, view);
    simulation.advance(1 / 60);
  }

  // One frame's worth of streaks, not sixty accumulated into the same pixels. The
  // canvas clears every frame and so does this: drawing the whole history is what
  // turns a sparse tracer field into black static.
  const out = new Uint8ClampedArray(base);
  const scaleX = W / simulation.width;
  const scaleY = H / simulation.height;

  for (let i = 0; i < tracers.count; i++) {
    const steps = 12;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const px = Math.round((tracers.tailX[i] + (tracers.x[i] - tracers.tailX[i]) * t) * scaleX);
      const py = Math.round((tracers.tailY[i] + (tracers.y[i] - tracers.tailY[i]) * t) * scaleY);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const at = (py * W + px) * 4;
      const ink = 0.22 * (1 - t);
      out[at] *= 1 - ink;
      out[at + 1] *= 1 - ink;
      out[at + 2] *= 1 - ink;
      out[at + 3] = 255;
    }
  }
  return out;
}

function withFieldView(simulation: PigmentSimulation, base: Pixels, mode: FieldViewMode, gain: number): Pixels {
  const overlay = new Uint8ClampedArray(simulation.width * simulation.height * 4);
  writeFieldView(overlay, simulation.width, simulation.height, simulation.field, mode, gain);

  const out = new Uint8ClampedArray(base);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(simulation.height - 1, Math.floor((y / H) * simulation.height));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(simulation.width - 1, Math.floor((x / W) * simulation.width));
      const from = (sy * simulation.width + sx) * 4;
      const at = (y * W + x) * 4;
      // The overlay's alpha carries its magnitude, and a bare cell of the base has to
      // stay bare: forcing it opaque would paint the empty board black.
      const a = (overlay[from + 3] / 255) * 0.55 * (out[at + 3] / 255);
      out[at] = out[at] * (1 - a) + overlay[from] * a;
      out[at + 1] = out[at + 1] * (1 - a) + overlay[from + 1] * a;
      out[at + 2] = out[at + 2] * (1 - a) + overlay[from + 2] * a;
    }
  }
  return out;
}

const palettes: [string, ReturnType<typeof buildPalette>][] = [
  ["hue 24, split", buildPalette({ hue: 24, harmony: "split", chroma: 0.2, spread: 1, ramp: 0.6, count: 4 })],
  ["hue 210, triadic", buildPalette({ hue: 210, harmony: "triadic", chroma: 0.18, spread: 0.6, ramp: 0.7, count: 4 })],
  ["hue 140, analogous", buildPalette({ hue: 140, harmony: "analogous", chroma: 0.24, spread: 0.9, ramp: 0.5, count: 4 })],
  ["hue 330, tetradic", buildPalette({ hue: 330, harmony: "tetradic", chroma: 0.16, spread: 0.5, ramp: 0.8, count: 4 })],
];

const tiles: ReturnType<typeof upscale>[] = [];
const labels: string[] = [];
/**
 * Every tile is scaled up to the same edge, whatever it was simulated at.
 *
 * The sheet's columns are laid out from the first tile's width, so a half-size tile
 * blitted in beside a full-size one lands half a column across and the whole grid
 * shears.
 */
const add = (data: Pixels, label: string, source = W): void => {
  tiles.push(upscale(flatten(data), source, source, (W * SCALE) / source));
  labels.push(label);
};

for (const [name, palette] of LAB_ONLY ? [] : palettes) {
  for (const seconds of SECONDS) {
    add(render(palette, "tide", seconds), `${name} @ ${seconds}s`);
  }
}
for (const layout of LAB_ONLY ? [] : LAYOUT_NAMES) {
  add(render(palettes[1][1], layout, 12), `layout ${layout} @ 12s`);
}

const lab = (settings: Parameters<typeof run>[0] = {}): PigmentSimulation => {
  const simulation = run({ ...settings, width: LAB });
  simulate(simulation, LAB_SECONDS);
  return simulation;
};

for (const name of Object.keys(PRESETS)) {
  const settings = applyPreset(DEFAULT_SETTINGS, name);
  const simulation = lab({ ...settings, layout: settings.layout });
  let data = expand(simulation.surface.image.data as Pixels, simulation.width);
  if (settings.tracers) data = withTracers(simulation, data, settings.tracerCount, settings.tracerTail);
  if (settings.fieldView !== "off") data = withFieldView(simulation, data, settings.fieldView, settings.fieldGain);
  add(data, `preset ${name}`, W);
}

// One board, three flushes: relief is a painting pass, not a change to the flow.
const reliefBoard = lab();
for (const relief of [0, 0.4, 0.8]) {
  reliefBoard.surface.setRelief(relief);
  reliefBoard.paint();
  add(reliefBoard.surface.image.data as Pixels, `relief ${relief}`, LAB);
}

// One board, six crops: the camera never touches the simulation.
const cameraBoard = lab();
for (const zoom of [1, 2, 4, 8]) {
  add(crop(cameraBoard.surface.image.data as Pixels, LAB, LAB, zoom), `zoom ${zoom}x`, W);
}
for (const [zoom, centreX, centreY] of [
  [2, 0.28, 0.5],
  [4, 0.72, 0.5],
] as [number, number, number][]) {
  add(crop(cameraBoard.surface.image.data as Pixels, LAB, LAB, zoom, centreX, centreY), `zoom ${zoom}x @ ${centreX}`, W);
}

const fieldBoard = lab();
const fieldBase = expand(fieldBoard.surface.image.data as Pixels, fieldBoard.width);
for (const mode of ["speed", "curl"] as FieldViewMode[]) {
  add(withFieldView(fieldBoard, fieldBase, mode, 1), `field ${mode}`, W);
}

for (const heading of [0, 90, 180, 270]) {
  add(lab({ heading }).surface.image.data as Pixels, `heading ${heading}°`, LAB);
}

const columns = 4;
const rows = Math.ceil(tiles.length / columns);
const sheetWidth = columns * tiles[0].width + (columns + 1) * GAP;
const sheetHeight = rows * tiles[0].height + (rows + 1) * GAP;
const sheet = new Uint8ClampedArray(sheetWidth * sheetHeight * 4).fill(242);
for (let i = 3; i < sheet.length; i += 4) sheet[i] = 255;

tiles.forEach((tile, index) => {
  const column = index % columns;
  const row = (index / columns) | 0;
  blit(sheet, sheetWidth, tile.data, tile.width, tile.height, GAP + column * (tile.width + GAP), GAP + row * (tile.height + GAP));
});

const out = process.argv[2] ?? "sim-preview.png";
writeFileSync(out, encodePng(sheet, sheetWidth, sheetHeight));
console.log(`${out}  ${sheetWidth}x${sheetHeight}`);
labels.forEach((label, index) => console.log(`  ${String(index).padStart(2)} ${label}`));