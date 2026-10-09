/*
 * Recursive subdivision.
 *
 * A rectangle, cut in half, each half cut in half again, to a fixed depth. That is
 * the whole algorithm, and the interesting decisions are all in how the cut is
 * chosen and where it lands.
 *
 * Two of them matter more than they look:
 *
 * **The leaf count is fixed at 2^depth.** The recursion never stops early, so
 * regenerating always produces exactly the same number of cells.
 *
 * **The axis follows the parent sometimes.** `grain` decides how often a rectangle
 * inherits the direction its parent was cut in rather than choosing its own. With
 * it at zero every cell picks independently and the result reads as noise; with it
 * high the composition grows long parallel bands. The range between the two is
 * where a picture starts to look designed.
 *
 * The one invariant everything else leans on: **the output tiles the board
 * exactly.** Cells are edges, not origin-plus-size, so a boundary is a single
 * number handed to both neighbours rather than two expressions that happen to
 * agree. See `Cell` for why that difference is visible.
 *
 * Pure and framework-free: rectangles in, cells out.
 */

/**
 * A cell, as the four edges that bound it.
 *
 * Edges rather than `x/y/w/h` because a shared boundary has to be one number owned
 * by both neighbours. Deriving each child from its parent as `x = parent.x + cut`
 * and `w = parent.w - cut` writes that boundary down twice, and the two writes
 * disagree in the last bits. Nothing shows it in normalised coordinates, but a
 * renderer that snaps to the device pixel grid turns the disagreement into a
 * one-pixel seam or overlap, and the grid stops being flush with its own fills.
 */
export type Cell = {
  /** Position in the output, and its identity across regenerations. */
  index: number;
  /** How many cuts from the root. Every cell is at the same depth by construction. */
  depth: number;
  /** The ratio this cell was cut at, 0..1. Its own share of its parent. */
  share: number;
  /** Which way its parent was cut. 1 is a vertical cut, 0 horizontal. */
  axis: 1 | 0;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** A line between two normalised points. Always axis-aligned. */
export type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SubdivisionOptions = {
  /** Cuts from the root. Depth 6 is 64 cells. */
  depth: number;
  /**
   * The smallest share a cut may leave, as a fraction.
   *
   * 0.5 is a perfect grid and 0.08 is a very lopsided one. Because both halves of a
   * cut are clamped to at least this much, the recursion always terminates on
   * rectangles of usable size regardless of what the random draw produced.
   */
  irregularity: number;
  /**
   * Chance of inheriting the parent's cut direction instead of choosing one.
   *
   * This is the single biggest lever on whether the result reads as a composition
   * or as noise, and it is the one that has no equivalent in a plain bisection.
   */
  grain: number;
  /**
   * How strongly to prefer cutting the longer side, 0..1.
   *
   * Cutting the long side is what keeps the cells from degenerating into slivers,
   * and it is what makes the partitions look deliberate rather than arbitrary.
   */
  bias: number;
  /**
   * Smallest share of the board a cell may occupy.
   *
   * Overrides `areaFloor`. A cell's area is the product of its own cut ratio and
   * every ancestor's, so a fixed floor has to be tight enough for the deepest
   * supported cut or the smallest cell ends up a few pixels across.
   */
  minArea?: number;
  /** Seed for the random draws. The same seed always produces the same partition. */
  seed?: number;
};

/** Depth 7 is 128 cells, which is about as many as a board this size can carry. */
const MAX_DEPTH = 7;

/**
 * Coordinates snap to this lattice.
 *
 * A power of two, so multiplying by it and dividing by it are both exact in binary
 * floating point and a snapped edge is a fraction nothing downstream has to round.
 * 4096 is far finer than a device pixel on any board this renders into, so it costs
 * no visible resolution, and it stops a chain of seven cuts from accumulating
 * drift in the low bits.
 */
const LATTICE = 4096;

/**
 * Smallest cell the partition may contain, as a fraction of the average cell.
 *
 * Measured against the average cell rather than against the board, because the
 * average cell is what shrinks as the depth rises. A floor fixed to the board
 * tightens the cut ratios further with every level, and by depth seven it clamps
 * every ratio to the same value: the slider reads as broken and the only reachable
 * picture is a perfect grid.
 */
const MIN_CELL_VS_MEAN = 25;

/** Small deterministic PRNG. Same seed, same picture, on every device. */
function rng(seed: number): () => number {
  let state = (seed | 0) ^ 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function snap(value: number): number {
  return Math.round(value * LATTICE) / LATTICE;
}

/**
 * Places one cut, snapped, and never closer than a lattice step to either end.
 *
 * A cut that landed within a step of the edge would round onto it and collapse the
 * child to nothing. Clamping keeps both sides at least one step wide, and because
 * the bounds are themselves lattice values the clamped cut is still on the
 * lattice — which is what the child on the far side is then snapped against.
 */
function snapCut(start: number, end: number, ratio: number): number {
  const cut = snap(start + (end - start) * ratio);
  return Math.min(Math.max(cut, start + 1 / LATTICE), end - 1 / LATTICE);
}

/**
 * The area floor a depth implies, and so the narrowest cut ratio that depth honours.
 *
 * A cell's area is its own ratio times every ancestor's, so the floor that keeps
 * the worst case above `minArea` is that area's `depth`-th root. Exported because
 * this number is also the bottom of the irregularity control: a cut ratio below it
 * is silently clamped, and a slider whose lower half does nothing reads as a bug.
 */
export function areaFloor(depth: number): number {
  const levels = Math.max(1, Math.min(MAX_DEPTH, Math.round(depth)));
  return Math.max(0.06, Math.min(0.49, (1 / (MIN_CELL_VS_MEAN * 2 ** levels)) ** (1 / levels)));
}

/**
 * Chooses the direction of one cut.
 *
 * A vertical cut divides the width, so a wide rectangle wants one and a tall one
 * does not. `bias` is a preference, not a command: at full strength a wide
 * rectangle is cut vertically 85% of the time, never always.
 *
 * That cap matters more than it looks. A command to always cut the long side, plus
 * a grain high enough to keep inheriting, turns the whole board into one column of
 * strips: a tall child of a wide parent is still wide enough to want a vertical
 * cut, so the bias never releases and there is no horizontal structure anywhere in
 * the picture.
 */
function chooseAxis(box: Box, inherited: 1 | 0, options: SubdivisionOptions, random: () => number): 1 | 0 {
  if (random() < options.grain) return inherited;

  const wide = box.x1 - box.x0 >= box.y1 - box.y0;
  const chance = 0.5 + (wide ? 1 : -1) * options.bias * 0.35;
  return random() < chance ? 1 : 0;
}

/** Internal walk state. Same edges as `Cell`, minus the bookkeeping. */
type Box = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export function subdivide(options: SubdivisionOptions): Cell[] {
  const random = rng(options.seed ?? 1);
  const cells: Cell[] = [];

  const depth = Math.max(1, Math.min(MAX_DEPTH, Math.round(options.depth)));
  // Clamped on both ends: a share above a half would invert the two children and
  // leave a gap, and a share of zero would never terminate.
  const floor = Math.max(
    0.06,
    Math.min(
      0.5,
      Math.max(
        options.irregularity,
        options.minArea === undefined ? areaFloor(depth) : Math.max(0.06, options.minArea) ** (1 / depth)
      )
    )
  );

  function walk(box: Box, level: number, inherited: 1 | 0, share: number): void {
    if (level <= 0) {
      cells.push({ index: cells.length, depth, share, axis: inherited, ...box });
      return;
    }

    const axis = floor === 0.5
      ? (box.x1 - box.x0 >= box.y1 - box.y0 ? 1 : 0)
      : chooseAxis(box, inherited, options, random);
    // The draw is symmetric around a half, so `floor` and `1 - floor` are equally
    // likely and the partition stays unbiased.
    const ratio = Math.max(floor, Math.min(1 - floor, 0.5 + (random() * 2 - 1) * (0.5 - floor)));

    // One cut, one number, given to both children as their shared edge. This is
    // the whole reason the partition has no seams.
    if (axis === 1) {
      const mid = snapCut(box.x0, box.x1, ratio);
      walk({ x0: box.x0, y0: box.y0, x1: mid, y1: box.y1 }, level - 1, axis, ratio);
      walk({ x0: mid, y0: box.y0, x1: box.x1, y1: box.y1 }, level - 1, axis, 1 - ratio);
      return;
    }

    const mid = snapCut(box.y0, box.y1, ratio);
    walk({ x0: box.x0, y0: box.y0, x1: box.x1, y1: mid }, level - 1, axis, ratio);
    walk({ x0: box.x0, y0: mid, x1: box.x1, y1: box.y1 }, level - 1, axis, 1 - ratio);
  }

  walk({ x0: 0, y0: 0, x1: 1, y1: 1 }, depth, 1, 1);
  return cells;
}

type Run = { at: number; from: number; to: number };

/**
 * Collapses overlapping spans on the same line into single runs.
 *
 * A guillotine cut can leave three cells touching one line at overlapping spans —
 * split the left half horizontally at 0.3 and the right at 0.7 and the line at
 * x=0.5 is covered by three separate cell sides. Merging keeps the boundary list
 * minimal instead of overdrawing the same line twice.
 */
function mergeRuns(spans: Run[]): Run[] {
  const byLine = new Map<number, number[]>();
  for (const span of spans) {
    const bounds = byLine.get(span.at);
    if (bounds) bounds.push(span.from, span.to);
    else byLine.set(span.at, [span.from, span.to]);
  }

  const merged: Run[] = [];
  for (const [at, bounds] of byLine) {
    bounds.sort((a, b) => a - b);
    let from = bounds[0] ?? 0;
    let to = bounds[1] ?? 0;
    for (let i = 2; i < bounds.length; i += 2) {
      const start = bounds[i] ?? 0;
      const end = bounds[i + 1] ?? 0;
      if (start <= to) {
        to = Math.max(to, end);
        continue;
      }
      merged.push({ at, from, to });
      from = start;
      to = end;
    }
    merged.push({ at, from, to });
  }
  return merged;
}

/**
 * Every interior boundary of the partition, each one to be drawn exactly once.
 *
 * Cells cannot draw their own borders. Two cells sharing an edge both paint their
 * side of it, so an interior line comes out twice as dark as the board's own frame
 * and the grid reads as uneven weight; and at fractional device offsets each of
 * those two strokes is antialiased across two pixels while a stroke that happened
 * to land on an integer is not, so the lines vary in weight as well as position.
 * Collecting the boundaries here also means the grid and the fills are driven by
 * one set of numbers and cannot drift apart.
 *
 * A side that is not on the board's own boundary is interior by construction, and
 * the union of the non-boundary sides covers each interior line completely, so
 * there is nothing to detect and nothing to miss.
 */
export function interiorEdges(cells: readonly Cell[]): Segment[] {
  const vertical: Run[] = [];
  const horizontal: Run[] = [];

  for (const cell of cells) {
    if (cell.x1 < 1) vertical.push({ at: cell.x1, from: cell.y0, to: cell.y1 });
    if (cell.y1 < 1) horizontal.push({ at: cell.y1, from: cell.x0, to: cell.x1 });
  }

  return [
    ...mergeRuns(vertical).map((run) => ({ x1: run.at, y1: run.from, x2: run.at, y2: run.to })),
    ...mergeRuns(horizontal).map((run) => ({ x1: run.from, y1: run.at, x2: run.to, y2: run.at })),
  ];
}

/** Cells a given depth produces. Fixed, which is what makes the page animatable. */
export function cellCount(depth: number): number {
  return 2 ** Math.max(1, Math.min(MAX_DEPTH, Math.round(depth)));
}
