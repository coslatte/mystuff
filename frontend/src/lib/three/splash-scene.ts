/*
 * Splash clock.
 *
 * A recursive subdivision that recuts itself on a one-second beat, each cell
 * flipping between ink and paper as it travels. The abstraction is a clock face:
 * discrete ticks, mechanical movement, no continuous drift.
 *
 * It is the same partition algorithm as the `/subdivision` page, deliberately. The
 * earlier version scattered independent rectangles over a grid, and independent
 * rectangles overlap: their edges cross, one rectangle's outline lands in the middle
 * of its neighbour, and nothing lines up with anything. A partition cannot overlap,
 * so the drawing is flush by construction and the same module produces both screens.
 *
 * Flat by construction: an orthographic camera, unlit planes, no shadows and no
 * post-processing. Three.js is doing the timing and the pixel mapping, not the
 * lighting, because a brutalist drawing has nothing to shade.
 *
 * Loaded through a dynamic import from the boot controller, so this module and
 * the whole three.js bundle stay out of the critical path. The CSS fallback in
 * `boot-screen.css` covers the page until this module resolves.
 */

import {
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";
import { splashDepth, splashFrame } from "../boot/frame";
import { createCleanupRegistry, frameBudget } from "./dispose";

/** Half-width of the design box. Rectangles live in -50..50 on both axes. */
const EXTENT = 50;

/**
 * Width of the inked line, in css pixels.
 *
 * Each cell insets its fill by half of this, so a shared edge is inked from both
 * sides and the visible line comes to one css pixel. Expressed in css pixels rather
 * than device pixels so it matches the `1px` border the CSS fallback draws: the two
 * crossfade, and a weight difference would be the one thing the swap reveals.
 */
const LINE_CSS_PX = 1;

/** The tick. Every visible change happens because this elapsed. */
const BEAT_MS = 1000;

/**
 * Travel time for one morph, inside the beat.
 *
 * The targets change discretely, but snapping them instantly reads as a glitch
 * rather than a clock. 450ms of an ease-out leaves the remaining 550ms at rest,
 * which is the pause a real escapement has.
 */
const MORPH_MS = 450;

/** Cap the device pixel ratio: this is flat geometry, extra pixels buy nothing. */
const MAX_DPR = 2;

/** Flat rectangles do not need refresh rate; 30fps halves the GPU work on a 60Hz panel. */
const TARGET_FPS = 30;

/** Normalised edges of one cell, board-relative. Row 0 is the top of the canvas. */
type Pose = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type Rect = {
  border: Mesh<PlaneGeometry, MeshBasicMaterial>;
  fill: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** Pose at the start of the current beat, so the morph is absolute, not per-frame. */
  from: Pose;
  /** Pose being travelled to. */
  to: Pose;
  /** Latest interpolated pose, reused each frame to drive the meshes. */
  pose: Pose;
  /** Whether the cell was ink, 0..1, so colour rides the same clock as geometry. */
  fromInk: number;
  toInk: number;
  ink: number;
};

export type SplashScene = {
  /** Cleans up the loop, the GPU resources and the context. Safe to call twice. */
  release: () => void;
};

/**
 * Reads the theme instead of hardcoding hex values.
 *
 * `global.css` defines the palette in `@theme`, which emits the custom
 * properties this reads. A splash that duplicated the hex values would drift
 * from the site the first time the palette changed.
 */
function readPalette(host: HTMLElement): { ink: string; paper: string } {
  const styles = getComputedStyle(host);
  return {
    ink: styles.getPropertyValue("--color-brut-black").trim() || "#000000",
    paper: styles.getPropertyValue("--color-brut-bg").trim() || "#f2f2f2",
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function blendPose(from: Pose, to: Pose, t: number, out: Pose): void {
  out.x0 = lerp(from.x0, to.x0, t);
  out.y0 = lerp(from.y0, to.y0, t);
  out.x1 = lerp(from.x1, to.x1, t);
  out.y1 = lerp(from.y1, to.y1, t);
}

/**
 * Mounts the clock into a canvas.
 *
 * Returns null instead of throwing when WebGL is unavailable, so the caller can
 * keep the CSS fallback rather than showing a blank box. The caller owns the
 * `prefers-reduced-motion` check: this module assumes it was asked to animate.
 */
export function mountSplashScene(canvas: HTMLCanvasElement, host: HTMLElement): SplashScene | null {
  const { ink, paper } = readPalette(host);
  const inkColor = new Color(ink);
  const paperColor = new Color(paper);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }

  // A context can be constructed and still be unusable, and three only fails on
  // the first render rather than at construction time.
  const context = renderer.getContext();
  if (!context) {
    renderer.dispose();
    return null;
  }
  void context;

  renderer.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new OrthographicCamera(-EXTENT, EXTENT, EXTENT, -EXTENT, 0.1, 200);
  camera.position.z = 100;
  camera.lookAt(0, 0, 0);

  // One geometry shared by every rectangle. Border thickness comes from the
  // inset of the fill plane, not from a second geometry.
  const plane = new PlaneGeometry(1, 1);
  const cleanup = createCleanupRegistry();
  const rects: Rect[] = [];

  /** Half the inked edge of a cell, in world units. Reset by `resize`. */
  let border = 1;
  let beat = 0;

  function spawn(): void {
    const borderMaterial = new MeshBasicMaterial({ color: inkColor });
    const fillMaterial = new MeshBasicMaterial({ color: paperColor });

    const borderMesh = new Mesh(plane, borderMaterial);
    const fill = new Mesh(plane, fillMaterial);
    // A hair apart so the two coplanar quads cannot z-fight where they overlap.
    fill.position.z = 0.01;
    scene.add(borderMesh, fill);

    const rect: Rect = {
      border: borderMesh,
      fill,
      from: { x0: 0, y0: 0, x1: 0, y1: 0 },
      to: { x0: 0, y0: 0, x1: 0, y1: 0 },
      pose: { x0: 0, y0: 0, x1: 0, y1: 0 },
      fromInk: 0,
      toInk: 0,
      ink: 0,
    };
    rects.push(rect);

    // Materials are per-rect because the fill colour flips per cell, but the
    // geometry is shared across all of them and disposed once at the end.
    cleanup.add(() => {
      borderMaterial.dispose();
      fillMaterial.dispose();
      scene.remove(borderMesh, fill);
    });
  }

  function planBeat(): void {
    const frame = splashFrame(beat);
    beat += 1;

    // The count is fixed by the depth, so every beat is a pure morph of the same
    // cells. That is what keeps the composition continuous: nothing is born or dies
    // mid-beat, and there is no frame where the board is not fully covered.
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const cell = frame.cells[i];
      if (!rect || !cell) continue;
      rect.from = { ...rect.pose };
      rect.to = { x0: cell.x0, y0: cell.y0, x1: cell.x1, y1: cell.y1 };
      rect.fromInk = rect.ink;
      rect.toInk = frame.ink[i] ? 1 : 0;
    }
  }

  function applyPose(rect: Rect): void {
    const { x0, y0, x1, y1 } = rect.pose;
    // Row 0 is the top of the canvas, so the y axis is flipped into world space.
    const left = -EXTENT + x0 * EXTENT * 2;
    const right = -EXTENT + x1 * EXTENT * 2;
    const top = EXTENT - y0 * EXTENT * 2;
    const bottom = EXTENT - y1 * EXTENT * 2;
    const width = right - left;
    const height = top - bottom;
    const centreX = (left + right) / 2;
    const centreY = (top + bottom) / 2;

    rect.border.position.set(centreX, centreY, 0);
    rect.border.scale.set(width, height, 1);

    rect.fill.position.set(centreX, centreY, 0.01);
    rect.fill.scale.set(
      Math.max(0, width - border * 2),
      Math.max(0, height - border * 2),
      1
    );

    rect.fill.material.color.lerpColors(paperColor, inkColor, rect.ink);
    rect.border.material.color.lerpColors(inkColor, paperColor, rect.ink);
  }

  let raf = 0;
  let beatStart = performance.now();
  let accumulator = 0;

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);

    if (now - accumulator < frameBudget(TARGET_FPS)) return;
    accumulator = now;

    if (now - beatStart >= BEAT_MS) {
      beatStart = now;
      planBeat();
    }

    // Absolute progress through the beat, eased so movement lands early and then
    // holds still for the rest of the tick, like an escapement settling.
    const raw = Math.min(1, (now - beatStart) / MORPH_MS);
    const t = 1 - Math.pow(1 - raw, 3);

    for (const rect of rects) {
      blendPose(rect.from, rect.to, t, rect.pose);
      rect.ink = lerp(rect.fromInk, rect.toInk, t);
      applyPose(rect);
    }

    renderer.render(scene, camera);
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width));
    const height = Math.max(1, Math.round(box.height));
    renderer.setSize(width, height, false);
    // The design box stays square whatever the container measures, so the
    // composition is identical on every viewport instead of stretching.
    camera.left = -EXTENT;
    camera.right = EXTENT;
    camera.top = EXTENT;
    camera.bottom = -EXTENT;
    camera.updateProjectionMatrix();

    // `border` is a share of the edge, so it depends on how many pixels an edge is
    // worth. Half of a css pixel each side, so a shared edge inks one css pixel.
    const devicePerUnit = (height * renderer.getPixelRatio()) / (EXTENT * 2);
    const lineDevicePx = LINE_CSS_PX * renderer.getPixelRatio();
    border = lineDevicePx / 2 / Math.max(devicePerUnit, 0.0001);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  cleanup.add(() => observer.disconnect());
  cleanup.add(() => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  });
  cleanup.add(() => {
    scene.clear();
    rects.length = 0;
    plane.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  });

  resize();

  // Seed the composition so the first paint is already a partition rather than an
  // empty canvas that fills in over the first second.
  for (let i = 0; i < 2 ** splashDepth; i++) spawn();
  planBeat();
  for (const rect of rects) {
    rect.pose = { ...rect.to };
    rect.ink = rect.toInk;
    rect.fromInk = rect.toInk;
    applyPose(rect);
  }
  renderer.render(scene, camera);

  raf = requestAnimationFrame(tick);

  return { release: () => cleanup.release() };
}