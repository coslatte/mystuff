import { createConvChain, learnConvChain } from "../../lib/graphics/conv-chain";

const SAMPLES = [
  ["11111111", "10001000", "10001000", "10001000", "11111111", "00100010", "00100010", "00100010"],
  ["11001100", "11001100", "00110011", "00110011", "11001100", "11001100", "00110011", "00110011"],
  ["10000001", "11000011", "01100110", "00111100", "00111100", "01100110", "11000011", "10000001"],
  ["00000000", "01100110", "01100110", "00000000", "00011000", "00011000", "00000000", "00000000"],
];
const MODELS = SAMPLES.map(sample => learnConvChain(sample, 3, true));
const REFRESH_INTERVAL_MS = 4000;
const FRAME_INTERVAL_MS = 1000 / 30;
const COLOR_INTERVAL_MS = 1000 / 12;

function colorField(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - Math.floor(x), fy = y - Math.floor(y);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const gradient = (gx: number, gy: number, dx: number, dy: number) => {
    let hash = Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663) ^ seed;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    const angle = ((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff * Math.PI * 2;
    return Math.cos(angle) * dx + Math.sin(angle) * dy;
  };
  const top = gradient(ix, iy, fx, fy) * (1 - fade(fx)) + gradient(ix + 1, iy, fx - 1, fy) * fade(fx);
  const bottom = gradient(ix, iy + 1, fx, fy - 1) * (1 - fade(fx)) + gradient(ix + 1, iy + 1, fx - 1, fy - 1) * fade(fx);
  return (top * (1 - fade(fy)) + bottom * fade(fy) + 1) / 2;
}

export function bindConvChainHero(): () => void {
  const section = document.querySelector<HTMLElement>("[data-convchain-hero]");
  const canvas = section?.querySelector<HTMLCanvasElement>(".hero-convchain");
  if (!section || !canvas) return () => {};
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controller = new AbortController();
  let seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const colorSeed = crypto.getRandomValues(new Uint32Array(1))[0];
  const colors = { red: section.dataset.red ?? "#e4483d", blue: section.dataset.blue ?? "#2448c8", white: section.dataset.white ?? "#ffffff" };
  let paper = document.documentElement.dataset.theme === "dark" ? getComputedStyle(section).getPropertyValue("--color-brut-surface").trim() : colors.white;
  let modelIndex = Math.floor(Math.random() * MODELS.length);
  let chain = createConvChain(MODELS[modelIndex], 3, seed);
  let cellSize = 8;
  let frame: number | null = null;
  let initialized = false;
  let nextRefresh = performance.now() + REFRESH_INTERVAL_MS;
  let visible = false;
  let painted = new Uint8Array(0);
  let paintedColors = new Uint8Array(0);
  let colorMask = new Uint8Array(0);
  let lastPaint = -Infinity;
  let nextColorUpdate = 0;
  let colorPhase = 0;
  let colorDrift = 0;

  const paint = () => {
    frame = null;
    const now = performance.now();
    if (now - lastPaint < FRAME_INTERVAL_MS) {
      if (!motion.matches && visible && !document.hidden) frame = requestAnimationFrame(paint);
      return;
    }
    lastPaint = now;
    let restarted = false;
    if (!motion.matches) {
      if (performance.now() >= nextRefresh) {
        modelIndex = (modelIndex + 1 + Math.floor(Math.random() * (MODELS.length - 1))) % MODELS.length;
        seed = crypto.getRandomValues(new Uint32Array(1))[0];
        chain = createConvChain(MODELS[modelIndex], chain.size, seed, chain.height);
        nextRefresh = performance.now() + REFRESH_INTERVAL_MS;
        painted = new Uint8Array(0);
        restarted = true;
      }
      chain.step(512, 1);
    }
    let changedCells = 0;
    if (!restarted && painted.length === chain.cells.length) {
      for (let index = 0; index < chain.cells.length; index++) {
        if (painted[index] !== chain.cells[index]) changedCells++;
      }
    }
    const activity = changedCells / chain.cells.length;
    colorPhase += activity * 0.012;
    colorDrift += activity * 0.0008;
    if (colorMask.length !== chain.cells.length) {
      colorMask = new Uint8Array(chain.cells.length);
      paintedColors = new Uint8Array(chain.cells.length).fill(255);
      nextColorUpdate = 0;
    }
    if (now >= nextColorUpdate) {
      const threshold = 0.5 + Math.sin(colorPhase) * 0.08;
      for (let y = 0; y < chain.height; y++) {
        for (let x = 0; x < chain.size; x++) {
          colorMask[x + y * chain.size] = Number(colorField(x / 6 + colorDrift, y / 6 + colorDrift * 0.35, colorSeed) < threshold);
        }
      }
      nextColorUpdate = now + COLOR_INTERVAL_MS;
    }
    context.strokeStyle = "rgba(0, 0, 0, 0.12)";
    context.lineWidth = 0.6;
    for (let y = 0; y < chain.height; y++) {
      for (let x = 0; x < chain.size; x++) {
        const index = x + y * chain.size;
        const color = chain.cells[index] ? colorMask[index] ? 2 : 1 : 0;
        if (paintedColors[index] === color) continue;
        paintedColors[index] = color;
        context.fillStyle = color === 2 ? colors.red : color === 1 ? colors.blue : paper;
        context.clearRect(x * cellSize, y * cellSize, cellSize, cellSize);
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        context.strokeRect(x * cellSize + 0.3, y * cellSize + 0.3, cellSize - 0.6, cellSize - 0.6);
      }
    }
    painted = chain.cells.slice();
    if (!motion.matches && visible && !document.hidden) frame = requestAnimationFrame(paint);
  };
  const resize = () => {
    const bounds = section.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    if (initialized && canvas.width === width && canvas.height === height) return;
    initialized = true;
    canvas.width = width;
    canvas.height = height;
    cellSize = Math.max(3, Math.max(width, height) / 240);
    chain = createConvChain(MODELS[modelIndex], Math.max(3, Math.ceil(width / cellSize)), seed, Math.max(3, Math.ceil(height / cellSize)));
    painted = new Uint8Array(0);
    colorMask = new Uint8Array(0);
    lastPaint = -Infinity;
    if (frame !== null) cancelAnimationFrame(frame);
    paint();
  };
  const updateAnimation = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (visible && !document.hidden && !motion.matches && initialized) {
      nextRefresh = performance.now() + REFRESH_INTERVAL_MS;
      frame = requestAnimationFrame(paint);
    }
  };
  motion.addEventListener("change", updateAnimation, { signal: controller.signal });
  document.addEventListener("visibilitychange", updateAnimation, { signal: controller.signal });
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    updateAnimation();
  });
  visibilityObserver.observe(section);
  const themeObserver = new MutationObserver(() => {
    paper = document.documentElement.dataset.theme === "dark"
      ? getComputedStyle(section).getPropertyValue("--color-brut-surface").trim()
      : colors.white;
    painted = new Uint8Array(0);
    paintedColors.fill(255);
    lastPaint = -Infinity;
    if (frame !== null) cancelAnimationFrame(frame);
    paint();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const observer = new ResizeObserver(resize);
  observer.observe(section);
  resize();
  return () => {
    controller.abort();
    observer.disconnect();
    visibilityObserver.disconnect();
    themeObserver.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
