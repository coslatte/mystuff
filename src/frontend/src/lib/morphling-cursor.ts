type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
type Shape = { path: Point[]; corners: number };
type CursorMode = "default" | "text" | "precision";
type Morph =
  | { kind: "shape"; from: Point[]; to: Point[]; startedAt: number; duration: number }
  | { kind: "hover"; from: Point[]; fromCenter: Point[]; offset: number; startedAt: number; duration: number };

const TARGETS = "a, button, input, textarea, select, [contenteditable], [role='button'], [role='slider'], [data-cursor='precision']";
const CURSOR_RADIUS = 30;
const TARGET_PADDING = 7;
const MAX_TARGET_WIDTH = 800;
const MAX_TARGET_HEIGHT = 600;
const SAMPLES = 72;
const ROTATION_CYCLE_MS = 25_000;
const DOT_RADIUS = 8;
const GRADIENT_CYCLE_MS = 6_000;
const COLOR_FIELD_SIZE = 64;
const COLOR_FIELD_SIZE_CSS = DOT_RADIUS * 6;
const COLOR_WAVE_STRENGTH = 0.9;
const RGB = [[255, 0, 0], [0, 255, 0], [0, 0, 255]] as const;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function paintColorField(pixels: Uint8ClampedArray, now: number): void {
  const time = now / 1_000;
  const colorOffset = now / GRADIENT_CYCLE_MS;

  for (let y = 0; y < COLOR_FIELD_SIZE; y += 1) {
    const v = (y / (COLOR_FIELD_SIZE - 1) - 0.5) * 2.6;
    for (let x = 0; x < COLOR_FIELD_SIZE; x += 1) {
      const u = (x / (COLOR_FIELD_SIZE - 1) - 0.5) * 2.6;
      const warpedX = u + Math.sin(v * 2.8 + time * 0.32) * 0.28
        + Math.sin((u + v) * 2.1 - time * 0.18) * 0.13;
      const warpedY = v + Math.cos(u * 2.5 - time * 0.27) * 0.26
        + Math.sin((v - u) * 2.4 + time * 0.21) * 0.14;
      const wave = Math.sin(warpedX * 2.3 + warpedY * 1.7 + time * 0.22)
        + Math.cos(warpedY * 3.5 - warpedX * 1.2 - time * 0.16) * 0.5;
      const phase = ((colorOffset + wave * COLOR_WAVE_STRENGTH) % RGB.length + RGB.length) % RGB.length;
      const segment = Math.floor(phase);
      const progress = (1 - Math.cos((phase - segment) * Math.PI)) / 2;
      const from = RGB[segment] ?? RGB[0];
      const to = RGB[(segment + 1) % RGB.length] ?? RGB[1];
      const pixel = (y * COLOR_FIELD_SIZE + x) * 4;

      pixels[pixel] = mix(from[0], to[0], progress);
      pixels[pixel + 1] = mix(from[1], to[1], progress);
      pixels[pixel + 2] = mix(from[2], to[2], progress);
      pixels[pixel + 3] = 255;
    }
  }
}

function polygon(sides: number): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

function resample(vertices: readonly Point[]): Point[] {
  const lengths = vertices.map((point, index) => {
    const next = vertices[(index + 1) % vertices.length] ?? point;
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  let edge = 0;
  let edgeStart = 0;
  return Array.from({ length: SAMPLES }, (_, index) => {
    const distance = index * perimeter / SAMPLES;
    while (edge < lengths.length - 1 && edgeStart + (lengths[edge] ?? 0) < distance) {
      edgeStart += lengths[edge] ?? 0;
      edge += 1;
    }
    const from = vertices[edge] ?? { x: 0, y: 0 };
    const to = vertices[(edge + 1) % vertices.length] ?? from;
    const progress = (distance - edgeStart) / (lengths[edge] || 1);
    return { x: mix(from.x, to.x, progress), y: mix(from.y, to.y, progress) };
  });
}

const SHAPES: Shape[] = [
  ...[3, 4, 5, 6].map((sides) => (
    {
      path: resample(polygon(sides)),
      corners: sides
    })
  ),
  {
    path: polygon(SAMPLES)
      .map(({ x, y }) => ({ x: x * 0.88, y: y * 0.88 })),
    corners: 0
  },
];

const TEXT_PATH = resample([
  { x: -5, y: -13 }, { x: 5, y: -13 }, { x: 5, y: -11 },
  { x: 1.5, y: -11 }, { x: 1.5, y: 11 }, { x: 5, y: 11 },
  { x: 5, y: 13 }, { x: -5, y: 13 }, { x: -5, y: 11 },
  { x: -1.5, y: 11 }, { x: -1.5, y: -11 }, { x: -5, y: -11 },
]);
const PRECISION_PATH = resample([
  { x: 0, y: 0 }, { x: 19, y: 18 }, { x: 11, y: 18 },
  { x: 15, y: 27 }, { x: 10, y: 29 }, { x: 6, y: 20 }, { x: 0, y: 26 },
]);
const DOT_PATH = polygon(SAMPLES).map(({ x, y }) => ({ x: x * DOT_RADIUS, y: y * DOT_RADIUS }));
const TEXT_CENTER = resample([
  { x: -0.75, y: -10 }, { x: 0.75, y: -10 },
  { x: 0.75, y: 10 }, { x: -0.75, y: 10 },
]);
// The colored center drops the arrow's tail: a full arrow inside the arrow already on
// screen reads as a second cursor, which is what the smaller scale is judged against.
const PRECISION_CENTER = resample([
  { x: 0, y: 0 }, { x: 19, y: 18 }, { x: 11, y: 18 }, { x: 6, y: 20 }, { x: 0, y: 26 },
]).map(({ x, y }) => ({ x: x * 0.72, y: y * 0.72 }));

function cursorMode(target: Element | null): CursorMode {
  if (target?.matches("input[type='range'], [role='slider'], [data-cursor='precision']")) return "precision";
  if (target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return "text";
  if (target instanceof HTMLInputElement && ["text", "search", "email", "url", "tel", "password", "number"].includes(target.type)) return "text";
  return "default";
}

function rotate(path: readonly Point[], angle: number): Point[] {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return path.map(({ x, y }) => ({ x: x * cosine - y * sine, y: x * sine + y * cosine }));
}

function bestOffset(from: readonly Point[], to: readonly Point[]): number {
  let offset = 0;
  let best = Infinity;
  for (let candidate = 0; candidate < SAMPLES; candidate += 1) {
    let distance = 0;
    for (let index = 0; index < SAMPLES; index += 1) {
      const a = from[index] ?? { x: 0, y: 0 };
      const b = to[(index + candidate) % SAMPLES] ?? a;
      distance += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    }
    if (distance < best) {
      best = distance;
      offset = candidate;
    }
  }
  return offset;
}

function shift(path: readonly Point[], offset: number): Point[] {
  return path.map((_, index) => path[(index + offset) % SAMPLES] ?? { x: 0, y: 0 });
}

function blend(from: readonly Point[], to: readonly Point[], progress: number): Point[] {
  return from.map((point, index) => ({
    x: mix(point.x, to[index]?.x ?? point.x, progress),
    y: mix(point.y, to[index]?.y ?? point.y, progress),
  }));
}

export function outlineBounds(rect: Bounds, pointer: Point): Bounds {
  const width = Math.min(rect.width + TARGET_PADDING * 2, MAX_TARGET_WIDTH);
  const height = Math.min(rect.height + TARGET_PADDING * 2, MAX_TARGET_HEIGHT);
  const left = rect.left - TARGET_PADDING;
  const top = rect.top - TARGET_PADDING;
  return {
    left: clamp(pointer.x - width / 2, left, left + rect.width + TARGET_PADDING * 2 - width),
    top: clamp(pointer.y - height / 2, top, top + rect.height + TARGET_PADDING * 2 - height),
    width,
    height,
  };
}

function rectanglePath(bounds: Bounds, pointer: Point): Point[] {
  const left = bounds.left - pointer.x;
  const top = bounds.top - pointer.y;
  const corners: Point[] = [
    { x: left, y: top },
    { x: left + bounds.width, y: top },
    { x: left + bounds.width, y: top + bounds.height },
    { x: left, y: top + bounds.height },
  ];
  const edgeLengths = corners.map((from, index) => {
    const to = corners[(index + 1) % corners.length] ?? from;
    return Math.hypot(to.x - from.x, to.y - from.y);
  });
  const edgeSamples = SAMPLES - corners.length;
  const perimeter = edgeLengths.reduce((sum, length) => sum + length, 0);
  const allocations = edgeLengths.map(length => edgeSamples * length / perimeter);
  const counts = allocations.map(Math.floor);
  const remaining = edgeSamples - counts.reduce((sum, count) => sum + count, 0);
  const byRemainder = allocations.map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder.slice(0, remaining)) counts[index] = (counts[index] ?? 0) + 1;

  return corners.flatMap((from, index) => {
    const to = corners[(index + 1) % corners.length] ?? from;
    const count = counts[index] ?? 0;
    const edge = Array.from({ length: count }, (_, step) => {
      const progress = (step + 1) / (count + 1);
      return { x: mix(from.x, to.x, progress), y: mix(from.y, to.y, progress) };
    });
    return [from, ...edge];
  });
}

export function translatePath(path: readonly Point[], pointer: Point): Point[] {
  return path.map((point) => ({ x: point.x + pointer.x, y: point.y + pointer.y }));
}

export function startMorphlingCursor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-morphling-cursor]");
  if (!canvas || canvas.dataset.ready === "true") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const colorField = document.createElement("canvas");
  colorField.width = COLOR_FIELD_SIZE;
  colorField.height = COLOR_FIELD_SIZE;
  const colorFieldContext = colorField.getContext("2d");
  if (!colorFieldContext) return;
  const drawingColorFieldContext = colorFieldContext;
  const colorFieldPixels = colorFieldContext.createImageData(COLOR_FIELD_SIZE, COLOR_FIELD_SIZE);
  canvas.dataset.ready = "true";
  const drawingCanvas = canvas;
  const drawingContext = context;

  let pointer: Point = { x: 0, y: 0 };
  let visible = false;
  let hovered: Element | null = null;
  let dragging: Element | null = null;
  let mode: CursorMode = "default";
  let centerPath = DOT_PATH;
  let lastBounds: Bounds | null = null;
  let shape = SHAPES[0] ?? { path: resample(polygon(3)), corners: 3 };
  let path = shape.path.map(({ x, y }) => ({ x: x * CURSOR_RADIUS, y: y * CURSOR_RADIUS }));
  let morph: Morph | null = null;
  let nextShapeAt = performance.now() + 6_000;
  let viewportWidth = 0;
  let viewportHeight = 0;

  function angle(now: number): number {
    return -(now / ROTATION_CYCLE_MS) * Math.PI * 2;
  }

  function freePath(now: number): Point[] {
    return rotate(shape.path, angle(now)).map(({ x, y }) => ({
      x: x * CURSOR_RADIUS,
      y: y * CURSOR_RADIUS,
    }));
  }

  function targetPath(): Point[] | null {
    if (mode === "text") return TEXT_PATH;
    if (mode === "precision") return PRECISION_PATH;
    if (hovered?.isConnected) {
      const rect = hovered.getBoundingClientRect();
      if (rect.width && rect.height) {
        lastBounds = outlineBounds(rect, pointer);
        return rectanglePath(lastBounds, pointer);
      }
    }
    return lastBounds ? rectanglePath(lastBounds, pointer) : null;
  }

  function setHovered(next: Element | null, now: number): void {
    const nextMode = cursorMode(next);
    if (next === hovered && nextMode === mode) return;
    if (hovered) targetPath();
    hovered = next;
    mode = nextMode;
    drawingCanvas.dataset.mode = mode;
    const destination = hovered ? targetPath() : freePath(now);
    if (!destination) return;
    morph = {
      kind: "hover",
      from: path,
      fromCenter: centerPath,
      offset: bestOffset(path, destination),
      startedAt: now,
      duration: 210,
    };
  }

  function findHovered(): Element | null {
    if (dragging?.isConnected) return dragging;
    const target = document.elementFromPoint(pointer.x, pointer.y);
    const candidate = target?.closest("[data-cursor-target]") ?? target?.closest(TARGETS) ?? null;
    return candidate?.hasAttribute("data-cursor-skip") ? null : candidate;
  }

  function resize(): void {
    const density = Math.min((window.devicePixelRatio || 1) * 2, 3);
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    drawingCanvas.width = Math.round(viewportWidth * density);
    drawingCanvas.height = Math.round(viewportHeight * density);
    drawingCanvas.style.width = String(viewportWidth) + "px";
    drawingCanvas.style.height = String(viewportHeight) + "px";
    drawingContext.setTransform(density, 0, 0, density, 0, 0);
  }

  function paint(now: number): void {
    drawingContext.clearRect(0, 0, viewportWidth, viewportHeight);
    if (visible && document.visibilityState === "visible") {
      if (hovered && !hovered.isConnected) setHovered(null, now);
      if (morph) {
        const progress = clamp((now - morph.startedAt) / morph.duration, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        if (morph.kind === "shape") {
          const rotated = blend(morph.from, morph.to, eased);
          path = rotate(rotated, angle(now) - angle(morph.startedAt));
        } else {
          const destination = hovered ? targetPath() : freePath(now);
          path = destination ? blend(morph.from, shift(destination, morph.offset), eased) : freePath(now);
          centerPath = blend(morph.fromCenter, mode === "text" ? TEXT_CENTER : mode === "precision" ? PRECISION_CENTER : DOT_PATH, eased);
        }
        if (progress === 1) morph = null;
      } else if (hovered) {
        path = targetPath() ?? freePath(now);
      } else if (now >= nextShapeAt) {
        const choices = SHAPES.filter((candidate) => candidate !== shape);
        const next = choices[Math.floor(Math.random() * choices.length)] ?? shape;
        const nextPath = rotate(next.path, angle(now)).map(({ x, y }) => ({
          x: x * CURSOR_RADIUS,
          y: y * CURSOR_RADIUS,
        }));
        morph = {
          kind: "shape",
          from: path,
          to: shift(nextPath, bestOffset(path, nextPath)),
          startedAt: now,
          duration: 2_700 + Math.abs(shape.corners - next.corners) * 80,
        };
        shape = next;
        nextShapeAt = now + 9_000 + Math.random() * 4_000;
      } else {
        path = freePath(now);
      }

      const points = translatePath(path, pointer);
      const first = points[0];
      if (first) {
        drawingContext.beginPath();
        drawingContext.moveTo(first.x, first.y);
        for (const point of points.slice(1)) drawingContext.lineTo(point.x, point.y);
        drawingContext.closePath();
        drawingContext.lineWidth = 1.2;
        drawingContext.strokeStyle = "#fff";
        drawingContext.stroke();
      }

      paintColorField(colorFieldPixels.data, now);
      drawingColorFieldContext.putImageData(colorFieldPixels, 0, 0);
      drawingContext.save();
      drawingContext.beginPath();
      const centerPoints = translatePath(centerPath, pointer);
      const centerFirst = centerPoints[0];
      if (centerFirst) {
        drawingContext.moveTo(centerFirst.x, centerFirst.y);
        for (const point of centerPoints.slice(1)) drawingContext.lineTo(point.x, point.y);
        drawingContext.closePath();
      }
      drawingContext.clip();
      // The oversized field lets its waves flow beyond the glyph without losing color coverage.
      drawingContext.drawImage(
        colorField,
        pointer.x - COLOR_FIELD_SIZE_CSS / 2,
        pointer.y - COLOR_FIELD_SIZE_CSS / 2,
        COLOR_FIELD_SIZE_CSS,
        COLOR_FIELD_SIZE_CSS
      );
      drawingContext.restore();
    }
    requestAnimationFrame(paint);
  }

  function move(event: PointerEvent): void {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    pointer = { x: event.clientX, y: event.clientY };
    visible = true;
    setHovered(findHovered(), performance.now());
  }

  function leave(): void {
    visible = false;
    hovered = null;
    dragging = null;
    mode = "default";
    centerPath = DOT_PATH;
    path = freePath(performance.now());
    drawingCanvas.dataset.mode = mode;
    lastBounds = null;
    morph = null;
  }

  resize();
  document.documentElement.classList.add("morphling-active");
  document.addEventListener("astro:after-swap", () => {
    document.documentElement.classList.add("morphling-active");
    leave();
  });
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    move(event);
    if (mode === "precision") dragging = hovered;
  }, { passive: true });
  const release = () => {
    dragging = null;
    if (visible) setHovered(findHovered(), performance.now());
  };
  window.addEventListener("pointerup", release, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });
  document.addEventListener("pointerleave", leave);
  window.addEventListener("scroll", () => {
    if (visible) setHovered(findHovered(), performance.now());
  }, { passive: true, capture: true });
  window.addEventListener("blur", leave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") leave();
  });
  requestAnimationFrame(paint);
}
