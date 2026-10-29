import { createConvChain, learnConvChain } from "../../lib/graphics/conv-chain";

const SAMPLES = [
  ["11111111", "10001000", "10001000", "10001000", "11111111", "00100010", "00100010", "00100010"],
  ["11001100", "11001100", "00110011", "00110011", "11001100", "11001100", "00110011", "00110011"],
  ["10000001", "11000011", "01100110", "00111100", "00111100", "01100110", "11000011", "10000001"],
  ["00000000", "01100110", "01100110", "00000000", "00011000", "00011000", "00000000", "00000000"],
];
const MODELS = SAMPLES.map(sample => learnConvChain(sample, 3, true));
const MIN_RADIUS = 32;
const MAX_RADIUS = 96;
const FADE_MS = 180;

export function bindConvChainHero(): () => void {
  const section = document.querySelector<HTMLElement>("[data-convchain-hero]");
  const canvas = section?.querySelector<HTMLCanvasElement>(".hero-convchain");
  if (!section || !canvas) return () => {};
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controller = new AbortController();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const colors = { red: section.dataset.red ?? "#e4483d", blue: section.dataset.blue ?? "#2448c8", white: section.dataset.white ?? "#ffffff" };
  let modelIndex = Math.floor(Math.random() * MODELS.length);
  let nextModelIndex = modelIndex;
  let chain = createConvChain(MODELS[modelIndex], 3, seed);
  let revealed = new Uint8Array(9);
  let expiresAt = new Float64Array(9);
  let pendingSteps: { x: number; y: number; radius: number }[] = [];
  let cometStroke = false;
  let cellSize = 8;
  const grid = document.createElement("canvas");
  const gridContext = grid.getContext("2d");
  let previous: { x: number; y: number } | null = null;
  let activeRegion: { x: number; y: number; radius: number } | null = null;
  let previousAt = 0;
  let frame: number | null = null;
  let initialized = false;

  const paint = () => {
    frame = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(grid, 0, 0);
    let changed = false;
    const now = performance.now();
    const hasVisibleTiles = expiresAt.some(expiry => expiry > now);
    if (hasVisibleTiles && activeRegion) {
      chain.step(120, 1, activeRegion);
      changed = true;
    }
    for (const step of pendingSteps.splice(0, 3)) {
      chain.step(400, 1, step);
      changed = true;
    }
    for (let y = 0; y < chain.height; y++) {
      for (let x = 0; x < chain.size; x++) {
        const index = x + y * chain.size;
        const remaining = expiresAt[index] - now;
        if (!revealed[index] || remaining <= 0) continue;
        const patch = Math.imul((x >> 3) + 1, 73856093) ^ Math.imul((y >> 3) + 1, 19349663) ^ seed;
        context.fillStyle = chain.cells[index] ? (patch >>> 0) % 4 === 0 ? colors.red : colors.blue : colors.white;
        context.globalAlpha = Math.min(1, remaining / FADE_MS);
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        context.strokeStyle = "rgba(0, 0, 0, 0.16)";
        context.lineWidth = 0.6;
        context.strokeRect(x * cellSize + 0.3, y * cellSize + 0.3, cellSize - 0.6, cellSize - 0.6);
        context.globalAlpha = 1;
        changed = true;
      }
    }
    const visible = expiresAt.some(expiry => expiry > now);
    if (!visible && !pendingSteps.length && nextModelIndex !== modelIndex) {
      modelIndex = nextModelIndex;
      chain = createConvChain(MODELS[modelIndex], chain.size, seed + Math.floor(Math.random() * 0xffffffff), chain.height);
      revealed = new Uint8Array(chain.cells.length);
      expiresAt = new Float64Array(chain.cells.length);
      activeRegion = null;
    }
    if (changed || pendingSteps.length) frame = requestAnimationFrame(paint);
  };
  const resize = () => {
    const bounds = section.getBoundingClientRect();
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    if (initialized && canvas.width === width && canvas.height === height) return;
    initialized = true;
    canvas.width = width;
    canvas.height = height;
    grid.width = width;
    grid.height = height;
    cellSize = Math.max(5, Math.max(width, height) / 256);
    if (gridContext) {
      gridContext.strokeStyle = "rgba(0, 0, 0, 0.07)";
      gridContext.lineWidth = 0.5;
      for (let x = 0; x <= width; x += cellSize) {
        gridContext.beginPath(); gridContext.moveTo(x, 0); gridContext.lineTo(x, height); gridContext.stroke();
      }
      for (let y = 0; y <= height; y += cellSize) {
        gridContext.beginPath(); gridContext.moveTo(0, y); gridContext.lineTo(width, y); gridContext.stroke();
      }
    }
    chain = createConvChain(MODELS[modelIndex], Math.max(3, Math.ceil(width / cellSize)), seed, Math.max(3, Math.ceil(height / cellSize)));
    revealed = new Uint8Array(chain.cells.length);
    expiresAt = new Float64Array(chain.cells.length);
    pendingSteps = [];
    previous = null;
    if (frame !== null) cancelAnimationFrame(frame);
    paint();
  };
  const move = (event: PointerEvent) => {
    if (motion.matches) return;
    const bounds = section.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const now = performance.now();
    const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : cellSize;
    if (distance < cellSize / 2) return;
    if (!previous) cometStroke = Math.random() < 0.02;
    const speed = previous && now > previousAt ? distance / (now - previousAt) : 0;
    const radiusPx = MIN_RADIUS + Math.min(1, speed / 1.4) * (MAX_RADIUS - MIN_RADIUS);
    const radius = radiusPx / cellSize;
    activeRegion = { x: point.x / cellSize, y: point.y / cellSize, radius: radius * 0.9 };
    const start = previous ?? point;
    const expires = now + 500 + FADE_MS;
    const stamps = Math.min(64, Math.max(1, Math.ceil(distance / (cellSize * 2))));
    for (let stamp = 1; stamp <= stamps; stamp++) {
      const x = (start.x + (point.x - start.x) * stamp / stamps) / cellSize;
      const y = (start.y + (point.y - start.y) * stamp / stamps) / cellSize;
      pendingSteps.push({ x, y, radius: radius * 0.9 });
      for (let cy = Math.max(0, Math.floor(y - radius)); cy < Math.min(chain.height, y + radius); cy++) {
        for (let cx = Math.max(0, Math.floor(x - radius)); cx < Math.min(chain.size, x + radius); cx++) {
          const dx = cx - x;
          const dy = cy - y;
          const angle = Math.atan2(dy, dx);
          const edge = radius * (1 + Math.sin(angle * 3 + seed * 0.00001) * 0.045 + Math.sin(angle * 5 - seed * 0.00002) * 0.025);
          if (Math.hypot(dx, dy) <= edge) {
            revealed[cx + cy * chain.size] = 1;
            expiresAt[cx + cy * chain.size] = expires;
          }
        }
      }
      if (cometStroke && distance > cellSize) {
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        const length = Math.hypot(dx, dy);
        for (let tail = 1; tail <= 5; tail++) {
          if (Math.random() > 0.62) continue;
          const tx = Math.round(x - dx / length * tail * 1.4);
          const ty = Math.round(y - dy / length * tail * 1.4);
          if (tx < 0 || tx >= chain.size || ty < 0 || ty >= chain.height) continue;
          const index = tx + ty * chain.size;
          revealed[index] = 1;
          expiresAt[index] = now + 2200;
        }
      }
    }
    previous = point;
    previousAt = now;
    if (frame === null) frame = requestAnimationFrame(paint);
  };
  section.addEventListener("pointermove", move, { signal: controller.signal });
  section.addEventListener("pointerleave", () => {
    previous = null;
    previousAt = 0;
    cometStroke = false;
    let next = modelIndex;
    while (next === modelIndex) next = Math.floor(Math.random() * MODELS.length);
    nextModelIndex = next;
  }, { signal: controller.signal });
  const observer = new ResizeObserver(resize);
  observer.observe(section);
  resize();
  return () => {
    controller.abort();
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
