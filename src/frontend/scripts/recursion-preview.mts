/*
 * Renders the recursive subdivision to a PNG contact sheet.
 *
 * Verification only; not part of the site bundle. Run with:
 *   bun run recursion-preview.mts [out.png]
 */

import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";

import { mix } from "spectral.js";
import { buildPalette, colorFor } from "../src/lib/color-theory";
import type { HarmonyName } from "../src/lib/color-theory";
import { subdivide, interiorEdges } from "../src/lib/recursion/subdivide";
import { blit, encodePng } from "./png";

if (process.argv.includes("--check")) {
  let partitions = 0;
  for (let depth = 1; depth <= 7; depth++) {
    for (let seed = 1; seed <= 40; seed++) {
      for (const irregularity of [0.06, 0.28, 0.49, 0.5]) {
        const options = { depth, seed, irregularity, grain: 0.3, bias: 0.55 };
        const opening = subdivide(options);
        assert.deepEqual(subdivide({ ...options, phase: 0 }), opening);
        for (const phase of [0, 0.7, 2.4, 6.28, 12]) {
          const cells = subdivide({ ...options, phase });
          assert.deepEqual(cells.map(cell => cell.axis), opening.map(cell => cell.axis));
          assert.equal(cells.length, 2 ** depth);
          let area = 0;
          for (const [index, cell] of cells.entries()) {
            assert.ok(cell.x0 >= 0 && cell.y0 >= 0 && cell.x1 <= 1 && cell.y1 <= 1);
            assert.ok(cell.x1 > cell.x0 && cell.y1 > cell.y0);
            area += (cell.x1 - cell.x0) * (cell.y1 - cell.y0);
            for (const other of cells.slice(index + 1)) {
              assert.ok(Math.min(cell.x1, other.x1) <= Math.max(cell.x0, other.x0)
                || Math.min(cell.y1, other.y1) <= Math.max(cell.y0, other.y0));
            }
            if (irregularity === 0.5) {
              assert.equal(cell.x1 - cell.x0, 1 / 2 ** Math.ceil(depth / 2));
              assert.equal(cell.y1 - cell.y0, 1 / 2 ** Math.floor(depth / 2));
            }
          }
          assert.equal(area, 1);
          for (const [width, height] of [[320, 180], [390, 844], [1440, 900]]) {
            const pixelArea = cells.reduce((sum, cell) => sum
              + (Math.round(cell.x1 * width) - Math.round(cell.x0 * width))
              * (Math.round(cell.y1 * height) - Math.round(cell.y0 * height)), 0);
            assert.equal(pixelArea, width * height);
          }
          const edges = interiorEdges(cells);
          for (const edge of edges) {
            const vertical = edge.x1 === edge.x2;
            const at = vertical ? edge.x1 : edge.y1;
            const from = vertical ? edge.y1 : edge.x1;
            const to = vertical ? edge.y2 : edge.x2;
            const covered = cells.reduce((sum, cell) => {
              if ((vertical ? cell.x1 : cell.y1) !== at) return sum;
              return sum + Math.max(0, Math.min(to, vertical ? cell.y1 : cell.x1)
                - Math.max(from, vertical ? cell.y0 : cell.x0));
            }, 0);
            assert.equal(covered, to - from);
          }
          const expectedLength = cells.reduce((sum, cell) => sum
            + (cell.x1 < 1 ? cell.y1 - cell.y0 : 0)
            + (cell.y1 < 1 ? cell.x1 - cell.x0 : 0), 0);
          assert.equal(edges.reduce((sum, edge) => sum + edge.x2 - edge.x1 + edge.y2 - edge.y1, 0), expectedLength);
          partitions++;
        }
      }
    }
  }
  console.log(`PASS: ${partitions} animated partitions tile exactly in normalized and device pixels, with matching edges and fixed split directions`);
  process.exit(0);
}

const SIZE = 300;
const SCALE = 2;
const GAP = 8;
const PAPER: [number, number, number] = [242, 242, 242];

type Tile = {
  label: string;
  data: Uint8ClampedArray;
};

function render(options: {
  depth: number;
  irregularity: number;
  grain: number;
  bias: number;
  seed: number;
  hue: number;
  harmony: HarmonyName;
  variance: number;
  bare: number;
}): Tile {
  const cells = subdivide(options);
  const colours = buildPalette({
    hue: options.hue,
    harmony: options.harmony,
    chroma: 0.22,
    spread: 1,
    ramp: 0.7,
    count: 4,
  }).hex.map(colorFor);

  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = PAPER[0];
    data[i * 4 + 1] = PAPER[1];
    data[i * 4 + 2] = PAPER[2];
    data[i * 4 + 3] = 255;
  }

  const last = colours.length - 1;
  cells.forEach((cell, index) => {
    const noise = ((index * 2654435761 + options.seed * 40503) % 1000) / 1000;
    const placed = (((cell.x0 + cell.x1) / 2 + (cell.y0 + cell.y1) / 2) / 2) * last;
    const t = placed + (noise - 0.5) * last * options.variance;

    const bare = ((index * 2246822519 + options.seed * 3266489917) >>> 0) % 1000 < options.bare * 1000;
    const from = colours[Math.max(0, Math.min(last, Math.floor(t)))];
    const to = colours[Math.max(0, Math.min(last, Math.ceil(t)))];
    const hex = bare
      ? null
      : from === to
        ? from.toString({ method: "clip" })
        : mix([from, 1 - (t - Math.floor(t))], [to, t - Math.floor(t)]).toString({ method: "clip" });
    if (!hex) return;

    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const x0 = Math.round(cell.x0 * SIZE);
    const x1 = Math.round(cell.x1 * SIZE);
    const y0 = Math.round(cell.y0 * SIZE);
    const y1 = Math.round(cell.y1 * SIZE);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const o = (y * SIZE + x) * 4;
        data[o] = rgb[0];
        data[o + 1] = rgb[1];
        data[o + 2] = rgb[2];
      }
    }
  });

  // The grid is drawn once, after the fills, from the same boundary list the page
  // renders. A hairline per cell side would double every interior line instead.
  for (const edge of interiorEdges(cells)) {
    const x0 = Math.round(edge.x1 * SIZE);
    const y0 = Math.round(edge.y1 * SIZE);
    const x1 = Math.round(edge.x2 * SIZE);
    const y1 = Math.round(edge.y2 * SIZE);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
        const o = (y * SIZE + x) * 4;
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
      }
    }
  }

  return { label: "", data };
}

const base = {
  depth: 4,
  irregularity: 0.28,
  grain: 0.3,
  bias: 0.55,
  seed: 7,
  hue: 20,
  harmony: "split" as HarmonyName,
  variance: 0.25,
  bare: 0.18,
};

const cases: { label: string; patch: Partial<typeof base> }[] = [
  { label: "base depth 4", patch: {} },
  { label: "depth 3", patch: { depth: 3 } },
  { label: "depth 5", patch: { depth: 5 } },
  { label: "depth 6", patch: { depth: 6 } },
  { label: "irregularity 0.10", patch: { irregularity: 0.1 } },
  { label: "grain 0", patch: { grain: 0 } },
  { label: "grain 0.7", patch: { grain: 0.7 } },
  { label: "bias 0", patch: { bias: 0 } },
  { label: "bias 1", patch: { bias: 1 } },
  { label: "triadic h200", patch: { harmony: "triadic", hue: 200 } },
  { label: "analogous h140", patch: { harmony: "analogous", hue: 140 } },
  { label: "tetradic h300", patch: { harmony: "tetradic", hue: 300 } },
  { label: "colour variance 0.8", patch: { variance: 0.8 } },
];

const tiles = cases.map((test) => {
  const tile = render({ ...base, ...test.patch });
  tile.label = test.label;
  return tile;
});

/** Nearest-neighbour upscale so a 300px partition is legible in the sheet. */
function upscale(data: Uint8ClampedArray, factor: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(SIZE * factor * SIZE * factor * 4);
  for (let y = 0; y < SIZE * factor; y++) {
    for (let x = 0; x < SIZE * factor; x++) {
      const from = (((y / factor) | 0) * SIZE + ((x / factor) | 0)) * 4;
      const to = (y * SIZE * factor + x) * 4;
      out[to] = data[from];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from + 2];
      out[to + 3] = 255;
    }
  }
  return out;
}

const columns = 4;
const rows = Math.ceil(tiles.length / columns);
const cell = SIZE * SCALE;
const sheetWidth = columns * cell + (columns + 1) * GAP;
const sheetHeight = rows * cell + (rows + 1) * GAP;
const sheet = new Uint8ClampedArray(sheetWidth * sheetHeight * 4).fill(242);
for (let i = 3; i < sheet.length; i += 4) sheet[i] = 255;

tiles.forEach((tile, index) => {
  blit(
    sheet,
    sheetWidth,
    upscale(tile.data, SCALE),
    cell,
    cell,
    GAP + ((index % columns) * (cell + GAP)),
    GAP + (((index / columns) | 0) * (cell + GAP))
  );
});

const out = process.argv[2] ?? "recursion-preview.png";
writeFileSync(out, encodePng(sheet, sheetWidth, sheetHeight));
console.log(`${out}  ${sheetWidth}x${sheetHeight}`);
tiles.forEach((tile, index) => console.log(`  ${String(index).padStart(2)} ${tile.label}`));
