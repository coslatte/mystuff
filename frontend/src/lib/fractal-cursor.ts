type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
type Shape = { path: Point[]; corners: number };
type Morph =
  | { kind: "shape"; from: Point[]; to: Point[]; startedAt: number; duration: number }
  | { kind: "hover"; from: Point[]; offset: number; startedAt: number; duration: number };

const TARGETS = "a, button, input, textarea, select, [role='button'], [data-cursor-target]";
const CURSOR_RADIUS = 30;
const TARGET_PADDING = 7;
const MAX_TARGET_WIDTH = 450;
const MAX_TARGET_HEIGHT = 300;
const SAMPLES = 72;
const ROTATION_CYCLE_MS = 30_000;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
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
  return resample([
    { x: left, y: top },
    { x: left + bounds.width, y: top },
    { x: left + bounds.width, y: top + bounds.height },
    { x: left, y: top + bounds.height },
  ]);
}

export function translatePath(path: readonly Point[], pointer: Point): Point[] {
  return path.map((point) => ({ x: point.x + pointer.x, y: point.y + pointer.y }));
}

export function startFractalCursor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-fractal-cursor]");
  if (!canvas || canvas.dataset.ready === "true") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  canvas.dataset.ready = "true";
  const drawingCanvas = canvas;
  const drawingContext = context;

  let pointer: Point = { x: 0, y: 0 };
  let visible = false;
  let hovered: Element | null = null;
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

  function currentRectangle(): Point[] | null {
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
    if (next === hovered) return;
    if (hovered) currentRectangle();
    hovered = next;
    const destination = hovered ? currentRectangle() : freePath(now);
    if (!destination) return;
    morph = {
      kind: "hover",
      from: path,
      offset: bestOffset(path, destination),
      startedAt: now,
      duration: 210,
    };
  }

  function findHovered(): Element | null {
    const candidate = document.elementFromPoint(pointer.x, pointer.y)?.closest(TARGETS) ?? null;
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
          const destination = hovered ? currentRectangle() : freePath(now);
          path = destination ? blend(morph.from, shift(destination, morph.offset), eased) : freePath(now);
        }
        if (progress === 1) morph = null;
      } else if (hovered) {
        path = currentRectangle() ?? freePath(now);
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
    lastBounds = null;
    morph = null;
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", move, { passive: true });
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
