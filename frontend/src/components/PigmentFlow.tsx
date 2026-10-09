/*
 * Pigment board.
 *
 * Presentation, and only presentation: the flow is `lib/sim`, the mixing is
 * `lib/pigment-math`, the palette is `lib/color-theory`, the view transform is
 * `lib/sim/camera` and every knob is one field of `lib/pigment-settings`. None of
 * those know a canvas exists, so any of them moves to a page background unchanged.
 * What is left here is the clock, three layers, the pointer and the keys.
 *
 * Three layers, in the order they are drawn:
 *
 *   field    grid resolution, bilinear upscaled. Pigment only.
 *   overlay  grid resolution. The speed/curl diagnostic, when it is on.
 *   tracers  board pixels. Streaks, the only layer that reports the field itself.
 *
 * There is no brush layer and there is no brush. Pigment only ever reaches the board
 * through the simulation, so the picture cannot be a stroke on top of a flow: it is
 * the flow, everywhere, including where the pointer has been.
 *
 * Zoom crops all three with one rect and never re-seats the grid: resizing the
 * simulation rebuilds its fields, so a zoom that also raised the resolution would
 * throw the picture away on every notch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPalette, colorFor } from "../lib/color-theory";
import { makePigment } from "../lib/pigment-math";
import {
  applyPreset,
  BOARD_SIZES,
  DEFAULT_SETTINGS,
  DETAIL,
  PRESET_NAMES,
  rememberSettings,
  restoreSettings,
  sanitize,
} from "../lib/pigment-settings";
import type { PigmentSettings, SettingsPatch } from "../lib/pigment-settings";
import { createCamera, panBy, project, unproject, viewRect, zoomAt, ZOOM_STEP } from "../lib/sim/camera";
import type { Camera } from "../lib/sim/camera";
import { FIELD_VIEW_MODES, writeFieldView } from "../lib/sim/field-view";
import { createTracers } from "../lib/sim/tracers";
import { LAYOUTS } from "../lib/sim/layouts";
import { createPigmentSimulation } from "../lib/sim/pigment-sim";
import type { PigmentSimulation } from "../lib/sim/pigment-sim";
import PigmentControls from "./PigmentControls";

/** Device pixel ratio cap. The mixing does real maths per cell, so 3x buys little. */
const MAX_DPR = 2;

/** A slider fires faster than a session should be rewritten. */
const SAVE_DELAY_MS = 500;

/** Alpha buckets for tracer strokes: a per-tracer `stroke` is the cheapest way to stutter. */
const TRACE_ALPHA_STEPS = 6;

type Pointer = {
  /** Board pixels at device resolution. */
  x: number;
  y: number;
  /** Same point one frame earlier, so the gesture has a velocity. */
  px: number;
  py: number;
  inside: boolean;
  down: boolean;
  panning: boolean;
};

/** Shown in the panel, and the same table the key handler reads. */
const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "space", label: "animate" },
  { keys: "r", label: "reset board" },
  { keys: "t", label: "tracers" },
  { keys: "p", label: "pointer stirs" },
  { keys: "f", label: "field view" },
  { keys: "wheel", label: "zoom" },
  { keys: "shift + drag", label: "pan" },
];

export default function PigmentFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<Pointer>({
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    inside: false,
    down: false,
    panning: false,
  });
  const sim = useRef<PigmentSimulation | null>(null);
  const traces = useRef<ReturnType<typeof createTracers> | null>(null);

  const [settings, setSettings] = useState<PigmentSettings>(DEFAULT_SETTINGS);
  const [camera, setCamera] = useState<Camera>(() => createCamera());
  const [chrome, setChrome] = useState(true);
  const [stats, setStats] = useState({ cells: 0, fps: 0, mixes: 0, traces: 0 });

  const live = useRef(settings);
  live.current = settings;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const patch = useCallback((next: SettingsPatch) => {
    setSettings((current) => sanitize(current, next));
  }, []);

  // Restored after hydration rather than during render: the module body also runs on
  // the server, where there is no storage, so a restored first frame would not match
  // the server's markup.
  useEffect(() => {
    setSettings(restoreSettings());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => rememberSettings(live.current), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const palette = useMemo(
    () =>
      buildPalette({
        hue: (settings.hue + settings.seed * 47) % 360,
        harmony: settings.harmony,
        chroma: settings.chroma,
        spread: settings.spread,
        ramp: settings.ramp,
        count: 4,
      }),
    [settings.hue, settings.harmony, settings.chroma, settings.spread, settings.ramp, settings.seed]
  );

  const pigments = useMemo(() => palette.hex.map((hex) => makePigment(colorFor(hex), 1, 1)), [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const fieldLayer = document.createElement("canvas");
    const overlayLayer = document.createElement("canvas");
    const fieldContext = fieldLayer.getContext("2d");
    const overlayContext = overlayLayer.getContext("2d");
    if (!fieldContext || !overlayContext) return;

    for (const target of [context, fieldContext]) {
      target.imageSmoothingEnabled = true;
      target.imageSmoothingQuality = "high";
    }

    const tracers = createTracers();
    const simulation = createPigmentSimulation({ pigments, layout: LAYOUTS[live.current.layout] });
    sim.current = simulation;
    traces.current = tracers;

    let overlay = new ImageData(1, 1);
    let raf = 0;
    let last = performance.now();
    let statAt = 0;

    // Arrow functions, not declarations: a hoisted declaration loses the null checks
    // above as far as TypeScript is concerned, and every use of `canvas` inside it
    // widens back to `| null`.
    const resize = (): void => {
      const box = canvas.getBoundingClientRect();
      if (box.width < 2) return;
      const scale = ratio();
      const width = Math.max(1, Math.round(box.width * scale));
      const height = Math.max(1, Math.round(box.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const next = gridFor(DETAIL[live.current.detail], width / height);
      if (next.width !== simulation.width || next.height !== simulation.height) {
        simulation.resize(next.width, next.height);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);

      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const current = live.current;
      const cam = cameraRef.current;
      const pointer = pointerRef.current;

      if (fieldLayer.width !== simulation.width || fieldLayer.height !== simulation.height) {
        fieldLayer.width = overlayLayer.width = simulation.width;
        fieldLayer.height = overlayLayer.height = simulation.height;
        overlay = new ImageData(simulation.width, simulation.height);
      }

      const box = {
        gridWidth: simulation.width,
        gridHeight: simulation.height,
        boardWidth: canvas.width,
        boardHeight: canvas.height,
      };
      const view = viewRect(cam, box);
      // Board pixels to cells. Everything the pointer does is in cells, because the
      // solver's damping, its ceiling and the emitters' speed all are: a force in
      // pixels would quietly mean something different at every zoom level.
      const cellsPerPixel = simulation.width / Math.max(1, canvas.width);

      if (current.running) {
        if (pointer.inside && current.pointer) {
          const cell = unproject(cam, box, pointer.x, pointer.y);
          const gestureX = pointer.x - pointer.px;
          const gestureY = pointer.y - pointer.py;
          const reach = Math.hypot(gestureX, gestureY);
          const radius = current.pointerRadius * ratio() * cellsPerPixel;

          if (reach > 0.01) {
            // The gesture sets the direction and the knob sets the speed. Tying the
            // speed to how fast the pointer moves means the force depends on the
            // visitor's hand, and the same settings behave differently on a laptop
            // trackpad and a desktop mouse.
            simulation.stir(
              cell.x,
              cell.y,
              (gestureX / reach) * current.pointerForce,
              (gestureY / reach) * current.pointerForce,
              radius,
              dt
            );
          }
          if (current.pointerDeposit > 0) {
            simulation.deposit(cell.x, cell.y, radius, current.pointerChannel, current.pointerDeposit * dt);
          }
        }

        simulation.advance(dt);
        if (current.tracers) tracers.advance(dt, simulation.field, view);
      }
      pointer.px = pointer.x;
      pointer.py = pointer.y;

      const surface = simulation.surface;
      surface.setRelief(current.relief);
      surface.flush(255);
      fieldContext.putImageData(surface.image, 0, 0);

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(fieldLayer, view.x, view.y, view.width, view.height, 0, 0, canvas.width, canvas.height);

      if (current.fieldView !== "off") {
        writeFieldView(
          overlay.data,
          simulation.width,
          simulation.height,
          simulation.field,
          current.fieldView,
          current.fieldGain
        );
        overlayContext.putImageData(overlay, 0, 0);
        context.globalAlpha = 0.55;
        context.drawImage(overlayLayer, view.x, view.y, view.width, view.height, 0, 0, canvas.width, canvas.height);
        context.globalAlpha = 1;
      }

      if (current.tracers) drawTracers(context, tracers, cam, box, current.tracerLife);

      if (now - statAt > 600) {
        statAt = now;
        setStats({
          cells: simulation.width * simulation.height,
          fps: dt > 0 ? Math.round(1 / dt) : 0,
          mixes: simulation.mixes,
          traces: tracers.count,
        });
      }
    };

    raf = requestAnimationFrame(frame);

    // React registers `wheel` at the root as a passive listener, so the page would
    // scroll out from under the cursor while zooming. Only a listener attached here
    // can refuse it.
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      setCamera((current) =>
        zoomAt(
          current,
          event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
          (event.clientX - bounds.left) / Math.max(1, bounds.width),
          (event.clientY - bounds.top) / Math.max(1, bounds.height)
        )
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      observer.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      sim.current = null;
      traces.current = null;
      fieldLayer.width = 0;
      overlayLayer.width = 0;
    };
  }, []);

  useEffect(() => {
    sim.current?.setPigments(pigments);
  }, [pigments]);

  useEffect(() => {
    sim.current?.setFlow({
      heading: settings.heading,
      vorticity: settings.turbulence,
      speed: settings.speed,
      density: settings.density,
      sweep: settings.sweep,
      dyeDamping: settings.wash,
      iterations: settings.iterations,
      velocityDamping: settings.velocityDamping,
    });
  }, [
    settings.heading,
    settings.turbulence,
    settings.speed,
    settings.density,
    settings.sweep,
    settings.wash,
    settings.iterations,
    settings.velocityDamping,
  ]);

  useEffect(() => {
    sim.current?.setLayout(LAYOUTS[settings.layout]);
  }, [settings.layout]);

  useEffect(() => {
    traces.current?.set({
      count: settings.tracers ? settings.tracerCount : 0,
      tail: settings.tracerTail,
      life: settings.tracerLife,
    });
  }, [settings.tracers, settings.tracerCount, settings.tracerTail, settings.tracerLife]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const simulation = sim.current;
    if (!canvas || !simulation) return;
    const next = gridFor(DETAIL[settings.detail], canvas.width / Math.max(1, canvas.height));
    if (next.width === simulation.width && next.height === simulation.height) return;
    simulation.resize(next.width, next.height);
  }, [settings.detail]);

  useEffect(() => {
    const typing = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

    const onKeyDown = (event: KeyboardEvent): void => {
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === " ") {
        // Refused so the page does not scroll under the board, and handled on keyup
        // so a held key toggles the animation once rather than once per repeat.
        event.preventDefault();
        return;
      }

      if (event.key === "+" || event.key === "=") setCamera((current) => zoomAt(current, ZOOM_STEP));
      else if (event.key === "-") setCamera((current) => zoomAt(current, 1 / ZOOM_STEP));
      else if (event.key === "0") setCamera(createCamera());
      else if (event.key === "r") sim.current?.reset();
      else if (event.key === "t") patch({ tracers: !live.current.tracers });
      else if (event.key === "p") patch({ pointer: !live.current.pointer });
      else if (event.key === "f") {
        const order = FIELD_VIEW_MODES;
        const at = order.indexOf(live.current.fieldView);
        patch({ fieldView: order[(at + 1) % order.length] });
      } else {
        const preset = PRESET_NAMES[Number(event.key) - 1];
        if (preset && /^[1-9]$/.test(event.key)) {
          setSettings((current) => applyPreset(current, preset));
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key === " ") patch({ running: !live.current.running });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [patch]);

  function toBoard(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = ratio();
    return { x: (event.clientX - bounds.left) * scale, y: (event.clientY - bounds.top) * scale };
  }

  const cursor = settings.pointer ? "cursor-cell" : "cursor-default";

  // The width goes on the panel, not the canvas. A canvas with no CSS width falls
  // back to its intrinsic size, which is the device-resolution backing store this
  // effect just wrote, so the board would grow by a device pixel ratio every resize.
  const boardWidth = BOARD_SIZES[settings.board] || "100%";

  return (
    <div className="flex flex-col gap-4 laptop:flex-row laptop:items-start">
      <section className="brut-panel relative max-w-full shrink-0 self-start" style={{ width: boardWidth }}>
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            const target = event.currentTarget;
            target.setPointerCapture(event.pointerId);
            const point = toBoard(event);
            const pointer = pointerRef.current;
            pointer.x = point.x;
            pointer.y = point.y;
            pointer.px = point.x;
            pointer.py = point.y;
            pointer.down = true;
            pointer.inside = true;
            pointer.panning = event.shiftKey || event.button === 1 || event.button === 2;
          }}
          onPointerMove={(event) => {
            const pointer = pointerRef.current;
            const point = toBoard(event);
            const dx = point.x - pointer.x;
            const dy = point.y - pointer.y;
            pointer.x = point.x;
            pointer.y = point.y;
            pointer.inside = true;
            if (!pointer.down || !pointer.panning) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            // Dragging the content right moves the camera left. `panBy` divides by
            // the zoom, which is what keeps the board under the cursor at any
            // magnification.
            setCamera((current) => panBy(current, -dx / canvas.width, -dy / canvas.height));
          }}
          onPointerUp={(event) => {
            const target = event.currentTarget;
            if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
            pointerRef.current.down = false;
            pointerRef.current.panning = false;
          }}
          onPointerCancel={() => {
            pointerRef.current.down = false;
            pointerRef.current.panning = false;
          }}
          onPointerLeave={() => {
            pointerRef.current.inside = false;
          }}
          onContextMenu={(event) => event.preventDefault()}
          className={`block aspect-square w-full touch-none active:cursor-grabbing ${cursor}`}
          aria-label="pigment board. move the pointer to stir the flow, scroll to zoom, shift and drag to pan."
        />
        <p className="brut-meta absolute bottom-2 left-2 bg-white px-2 py-1 normal-case">
          {stats.cells} cells · {stats.fps} fps · {stats.mixes} mixes · {stats.traces} traces ·{" "}
          {camera.zoom.toFixed(2)}x
        </p>
      </section>

      {chrome ? (
        <PigmentControls
          settings={settings}
          palette={palette.hex}
          camera={camera}
          onPatch={patch}
          onPreset={(name) => setSettings((current) => applyPreset(current, name))}
          onZoom={(factor) => setCamera((current) => zoomAt(current, factor))}
          onResetView={() => setCamera(createCamera())}
          onReset={() => sim.current?.reset()}
          onHide={() => setChrome(false)}
          shortcuts={SHORTCUTS}
        />
      ) : (
        <button type="button" className="brut-btn self-start text-xs" onClick={() => setChrome(true)}>
          show controls
        </button>
      )}
    </div>
  );
}

/**
 * Streaks for every live tracer, batched by fade.
 *
 * One `stroke` per tracer is 900 state changes a frame and it is the cheapest way to
 * make an otherwise smooth board stutter. Bucketing costs a quantised fade, which on
 * a two-pixel line cannot be told from a continuous one.
 */
function drawTracers(
  context: CanvasRenderingContext2D,
  tracers: ReturnType<typeof createTracers>,
  camera: Camera,
  frame: { gridWidth: number; gridHeight: number; boardWidth: number; boardHeight: number },
  life: number
): void {
  context.lineWidth = Math.max(1, frame.boardWidth / 900);
  context.lineCap = "round";

  for (let bucket = 0; bucket < TRACE_ALPHA_STEPS; bucket++) {
    context.beginPath();
    let drawn = 0;

    for (let i = 0; i < tracers.count; i++) {
      const fade = 1 - Math.min(1, tracers.age[i] / life);
      if (Math.floor(fade * TRACE_ALPHA_STEPS) !== bucket) continue;
      const head = project(camera, frame, tracers.x[i], tracers.y[i]);
      const tail = project(camera, frame, tracers.tailX[i], tracers.tailY[i]);
      context.moveTo(tail.x, tail.y);
      context.lineTo(head.x, head.y);
      drawn++;
    }

    if (drawn === 0) continue;
    context.strokeStyle = `rgba(0, 0, 0, ${0.06 + (bucket / TRACE_ALPHA_STEPS) * 0.3})`;
    context.stroke();
  }
}

function ratio(): number {
  return Math.min(MAX_DPR, window.devicePixelRatio || 1);
}

/** Grid dimensions holding roughly `budget` cells at the board's aspect. */
function gridFor(budget: number, aspect: number): { width: number; height: number } {
  const safe = Math.max(aspect, 0.2);
  const width = Math.max(24, Math.round(Math.sqrt(budget * safe)));
  return { width, height: Math.max(24, Math.round(width / safe)) };
}
