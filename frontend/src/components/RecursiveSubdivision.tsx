/*
 * Recursive subdivision.
 *
 * A rectangle, cut in half, each half cut in half again, to a fixed depth. The
 * geometry is `lib/recursion/subdivide`; this renders it and owns the knobs.
 *
 * Geometry changes atomically because a recut can change the partition topology.
 * Interpolating unrelated rectangles creates gaps and overlaps between frames.
 * Only the cell colours transition.
 *
 * Colour is a pigment mix per cell, computed with `spectral.js`, and the pigments
 * come from the same OKLCh harmony builder the flow page uses. A cell takes the two
 * colours its position falls between on the palette, so neighbouring cells tend to
 * be neighbouring mixtures and the partition reads as one colour field with a grid
 * drawn over it rather than as a grid with random colours in it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mix } from "spectral.js";
import { buildPalette, colorFor, HARMONY_NAMES } from "../lib/color-theory";
import type { HarmonyName } from "../lib/color-theory";
import { areaFloor, cellCount, interiorEdges, subdivide } from "../lib/recursion/subdivide";
import { Chips, Panel, Slider, Toggle } from "./controls";

/** Milliseconds between automatic regenerations. */
const AUTO_MS = 2600;

const COLOUR_MS = 200;

const DEPTHS = [1, 2, 3, 4, 5, 6, 7];

/** The board as measured, and the device pixel grid its edges are snapped to. */
type Board = {
  width: number;
  height: number;
  dpr: number;
};

function readBoard(element: HTMLElement): Board | null {
  const box = element.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;
  return { width: box.width, height: box.height, dpr: window.devicePixelRatio || 1 };
}

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function RecursiveSubdivision() {
  const [depth, setDepth] = useState(4);
  const [irregularity, setIrregularity] = useState(0.5);
  const [grain, setGrain] = useState(0.3);
  const [bias, setBias] = useState(0.55);
  const [seed, setSeed] = useState(7);

  const [hue, setHue] = useState(20);
  const [harmony, setHarmony] = useState<HarmonyName>("split");
  const [spread, setSpread] = useState(1);
  const [ramp, setRamp] = useState(0.7);
  /** Blends the position-driven colour against a per-cell random one. */
  const [colourVariance, setColourVariance] = useState(0.25);
  /** Chance a cell is left as bare paper, which is what gives the grid its relief. */
  const [bare, setBare] = useState(0.18);

  const [auto, setAuto] = useState(true);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [board, setBoard] = useState<Board | null>(null);

  /**
   * Measured from a ref callback rather than an effect, so the size is known in the
   * commit phase and the very first paint is already snapped to the pixel grid.
   * An effect would let one frame through unsnapped.
   */
  const attachBoard = useCallback((element: HTMLDivElement | null) => {
    boardRef.current = element;
    if (element) setBoard(readBoard(element));
  }, []);

  useEffect(() => {
    const element = boardRef.current;
    if (!element) return;
    const measure = () => setBoard(readBoard(element));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // A window dragged onto a display with a different pixel ratio can change the
    // snap without changing the board's size, so ResizeObserver alone misses it.
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /**
   * Below this ratio the cut is clamped, whatever the slider says. Read here rather
   * than inside `subdivide` so the control can show its own limit as its minimum.
   */
  const floor = Math.ceil(areaFloor(depth) * 100) / 100;
  const lopsided = Math.max(irregularity, floor);

  const cells = useMemo(
    () => subdivide({ depth, irregularity: lopsided, grain, bias, seed }),
    [depth, lopsided, grain, bias, seed]
  );

  const colours = useMemo(
    () => buildPalette({ hue, harmony, chroma: 0.22, spread, ramp, count: 4 }).hex.map(colorFor),
    [hue, harmony, spread, ramp]
  );

  /**
   * A cell's fill.
   *
   * The position along the palette comes from the cell's centre, so the partition
   * carries a gradient across the picture. `colourVariance` mixes that with a
   * per-cell random draw: at zero the whole board is one coherent field, at one it
   * is confetti, and in between the cells stay related without being predictable.
   */
  const fills = useMemo(() => {
    const last = colours.length - 1;
    return cells.map((cell, index) => {
      // A stable draw from the index and the seed, so a regeneration that moves a
      // cell keeps its character instead of being re-rolled with it.
      const noise = ((index * 2654435761 + seed * 40503) % 1000) / 1000;
      const placed = (((cell.x0 + cell.x1) / 2 + (cell.y0 + cell.y1) / 2) / 2) * last;
      const t = placed + (noise - 0.5) * last * colourVariance;

      const from = colours[Math.max(0, Math.min(last, Math.floor(t)))];
      const to = colours[Math.max(0, Math.min(last, Math.ceil(t)))];
      if (!from) return "#f2f2f2";

      const isBare = ((index * 2246822519 + seed * 3266489917) >>> 0) % 1000 < bare * 1000;
      if (isBare) return null;

      if (from === to) return from.toString({ method: "clip" });
      const weight = t - Math.floor(t);
      return mix([from, 1 - weight], [to, weight]).toString({ method: "clip" });
    });
  }, [cells, colours, colourVariance, bare, seed]);

  /**
   * The board, in css pixels aligned to whole device pixels.
   *
   * This is what makes the cells flush. Left to itself the browser resolves `left`
   * and `width` to used values independently, rounding each one, so a cell's right
   * edge is `round(left) + round(width)` while its neighbour's left edge is
   * `round(left)` of the same boundary — two different numbers, and up to a pixel of
   * seam between them. Snapping the boundary once and deriving both edges from that
   * single value removes the disagreement, and landing on the pixel grid stops the
   * lines being antialiased across two pixels when they miss.
   */
  const layout = useMemo(() => {
    if (!board) return null;
    const ink = 1 / board.dpr;
    const x = (value: number) => Math.round(value * board.width * board.dpr) / board.dpr;
    const y = (value: number) => Math.round(value * board.height * board.dpr) / board.dpr;

    const boxes: Box[] = cells.map((cell) => {
      const left = x(cell.x0);
      const top = y(cell.y0);
      return { left, top, width: x(cell.x1) - left, height: y(cell.y1) - top };
    });

    /**
     * The grid, as its own layer.
     *
     * A border on each cell would draw every interior line twice — once from each
     * side — so the grid would come out at double weight inside and single weight at
     * the frame. One thin element per boundary, placed on the same snapped value the
     * fills use, keeps the weight even and the registration exact.
     */
    const lines: Box[] = interiorEdges(cells).map((edge) => {
      const vertical = edge.x1 === edge.x2;
      const left = x(edge.x1);
      const top = y(edge.y1);
      return vertical
        ? { left, top, width: ink, height: y(edge.y2) - top }
        : { left, top, width: x(edge.x2) - left, height: ink };
    });

    return { boxes, lines };
  }, [cells, board]);

  // Automatic regeneration. Kept on an interval rather than a frame timer because
  // the picture is discrete: there is nothing to interpolate between generations.
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => setSeed((current) => (current + 1) % 100000), AUTO_MS);
    return () => clearInterval(timer);
  }, [auto]);

  const count = cells.length;

  return (
    <div className="grid grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="brut-panel relative self-start">
        <div ref={attachBoard} className="relative aspect-square w-full overflow-hidden bg-brut-bg">
          {layout
            ? layout.boxes.map((box, index) => (
                <div
                  key={index}
                  className="absolute transition-[background-color] motion-reduce:transition-none"
                  style={{
                    left: `${box.left}px`,
                    top: `${box.top}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    backgroundColor: fills[index] ?? "transparent",
                    transitionDuration: `${COLOUR_MS}ms`,
                  }}
                />
              ))
            : null}
          {layout
            ? layout.lines.map((box, index) => (
                <div
                  key={index}
                  className="absolute bg-black"
                  style={{
                    left: `${box.left}px`,
                    top: `${box.top}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                  }}
                />
              ))
            : null}
        </div>
        <p className="brut-meta absolute bottom-2 left-2 bg-white px-2 py-1 normal-case">
          {count} cells · depth {depth} · every cut splits in two
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <Panel
          title="partition"
          aside={<span className="font-mono text-[10px] text-brut-yellow">{count}</span>}
        >
          <Chips
            label="depth"
            value={String(depth)}
            options={DEPTHS.map(String)}
            onChange={(value) => setDepth(Number(value))}
          />
          <Slider
            label="irregularity"
            value={lopsided}
            min={floor}
            max={0.5}
            step={0.01}
            hint={`0.50 is an exact grid · ${floor.toFixed(2)} is the minimum at depth ${depth}`}
            onChange={setIrregularity}
          />
          <Slider
            label="grain"
            value={grain}
            min={0}
            max={0.9}
            step={0.02}
            accent="text-brut-violet"
            hint="how often a cell inherits its parent's cut direction"
            onChange={setGrain}
          />
          <Slider
            label="long side bias"
            value={bias}
            min={0}
            max={1}
            step={0.02}
            hint="preference, not a rule: 1 cuts the longer side 85% of the time"
            onChange={setBias}
          />
        </Panel>

        <Panel title="colour">
          <Slider
            label="base hue"
            value={hue}
            min={0}
            max={359}
            step={1}
            format={(value) => `${value.toFixed(0)}°`}
            accent="text-brut-violet"
            onChange={setHue}
          />
          <Chips label="harmony" value={harmony} options={HARMONY_NAMES} onChange={setHarmony} />
          <Slider
            label="hue spread"
            value={spread}
            min={0}
            max={1}
            step={0.02}
            onChange={setSpread}
          />
          <Slider
            label="light ramp"
            value={ramp}
            min={0}
            max={1}
            step={0.05}
            onChange={setRamp}
          />
          <Slider
            label="colour variance"
            value={colourVariance}
            min={0}
            max={1}
            step={0.02}
            accent="text-brut-violet"
            hint="0 is one coherent field, 1 is confetti"
            onChange={setColourVariance}
          />
          <Slider
            label="bare paper"
            value={bare}
            min={0}
            max={0.6}
            step={0.02}
            accent="text-brut-red"
            hint="chance a cell is left unpainted"
            onChange={setBare}
          />
        </Panel>

        <Panel title="output">
          <Toggle label="animate" checked={auto} onChange={setAuto} />
          <button
            type="button"
            onClick={() => setSeed((current) => (current + 1) % 100000)}
            className="brut-btn w-full text-xs"
          >
            recut
          </button>
          <p className="brut-meta normal-case text-gray-600">
            depth {depth} is {cellCount(depth)} cells, every time. cuts and their outlines update
            together, with no gaps or overlaps. only colours fade between cuts. at 0.50, cuts
            bisect the longer side to form a regular grid.
          </p>
        </Panel>
      </div>
    </div>
  );
}
