import type { Pigment } from "../pigment-math";
import { DETAIL, type PigmentSettings } from "../pigment-settings";
import { project, unproject, viewRect, ZOOM_STEP, type Camera } from "./camera";
import { writeFieldView } from "./field-view";
import { createTracers } from "./tracers";
import { LAYOUTS } from "./layouts";
import { createPigmentSimulation } from "./pigment-sim";

const MAX_DPR = 2;
const TRACE_ALPHA_STEPS = 6;

type BoardSnapshot = { settings: PigmentSettings; pigments: Pigment[]; camera: Camera };
type BoardOptions = BoardSnapshot & {
  onStats: (stats: { cells: number; fps: number; mixes: number; traces: number }) => void;
  onZoom: (factor: number, x: number, y: number) => void;
  onPan: (dx: number, dy: number) => void;
};
export type PigmentBoard = {
  update: (snapshot: BoardSnapshot) => void;
  reset: () => void;
  dispose: () => void;
};

export function mountPigmentBoard(canvas: HTMLCanvasElement, options: BoardOptions): PigmentBoard | null {
  const context = canvas.getContext("2d");
  const fieldLayer = document.createElement("canvas");
  const overlayLayer = document.createElement("canvas");
  const fieldContext = fieldLayer.getContext("2d");
  const overlayContext = overlayLayer.getContext("2d");
  if (!context || !fieldContext || !overlayContext) return null;
  for (const target of [context, fieldContext]) {
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = "high";
  }
  let snapshot: BoardSnapshot = options;
  const simulation = createPigmentSimulation({ pigments: options.pigments, layout: LAYOUTS[options.settings.layout] });
  const tracers = createTracers();
  const pointer = { x: 0, y: 0, px: 0, py: 0, inside: false, down: false, panning: false };
  let overlay = new ImageData(1, 1);
  let raf = 0;
  let disposed = false;
  let last = performance.now();
  let statAt = 0;

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    if (box.width < 2) return;
    const scale = ratio();
    const width = Math.max(1, Math.round(box.width * scale));
    const height = Math.max(1, Math.round(box.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const next = gridFor(DETAIL[snapshot.settings.detail], width / height);
    if (next.width !== simulation.width || next.height !== simulation.height) simulation.resize(next.width, next.height);
  };

  const configure = (settings: PigmentSettings, previous?: PigmentSettings) => {
    simulation.setFlow({
      heading: settings.heading, vorticity: settings.turbulence, speed: settings.speed,
      density: settings.density, sweep: settings.sweep, dyeDamping: settings.wash,
      iterations: settings.iterations, velocityDamping: settings.velocityDamping,
    });
    if (!previous || previous.layout !== settings.layout) simulation.setLayout(LAYOUTS[settings.layout]);
    if (!previous || previous.tracers !== settings.tracers || previous.tracerCount !== settings.tracerCount
      || previous.tracerTail !== settings.tracerTail || previous.tracerLife !== settings.tracerLife) {
      tracers.set({ count: settings.tracers ? settings.tracerCount : 0, tail: settings.tracerTail, life: settings.tracerLife });
    }
  };
  configure(options.settings);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const frame = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);

    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const current = snapshot.settings;
    const cam = snapshot.camera;

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
      options.onStats({
        cells: simulation.width * simulation.height,
        fps: dt > 0 ? Math.round(1 / dt) : 0,
        mixes: simulation.mixes,
        traces: tracers.count,
      });
    }
  };

  raf = requestAnimationFrame(frame);

  const toBoard = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const scale = ratio();
    return { x: (event.clientX - bounds.left) * scale, y: (event.clientY - bounds.top) * scale };
  };
  const onPointerDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    const point = toBoard(event);
    Object.assign(pointer, point, { px: point.x, py: point.y, down: true, inside: true,
      panning: event.shiftKey || event.button === 1 || event.button === 2 });
  };
  const onPointerMove = (event: PointerEvent) => {
    const point = toBoard(event);
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    Object.assign(pointer, point, { inside: true });
    if (pointer.down && pointer.panning) options.onPan(-dx / canvas.width, -dy / canvas.height);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer.down = pointer.panning = false;
  };
  const onPointerCancel = () => { pointer.down = pointer.panning = false; };
  const onPointerLeave = () => { pointer.inside = false; };
  const onContextMenu = (event: MouseEvent) => event.preventDefault();
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    options.onZoom(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
      (event.clientX - bounds.left) / Math.max(1, bounds.width),
      (event.clientY - bounds.top) / Math.max(1, bounds.height));
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  // A non-passive listener keeps zooming from scrolling the page.
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return {
    update(next) {
      if (disposed) return;
      const previous = snapshot;
      snapshot = next;
      if (previous.pigments !== next.pigments) simulation.setPigments(next.pigments);
      if (previous.settings !== next.settings) configure(next.settings, previous.settings);
      if (previous.settings.detail !== next.settings.detail) resize();
    },
    reset() {
      if (!disposed) simulation.reset();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("wheel", onWheel);
      pointer.down = pointer.panning = pointer.inside = false;
      fieldLayer.width = fieldLayer.height = overlayLayer.width = overlayLayer.height = 0;
    },
  };
}

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
