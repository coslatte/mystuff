import { createConvChain, learnConvChain } from "../../lib/graphics/conv-chain";

const SAMPLES = [
  ["11111111", "10001000", "10001000", "10001000", "11111111", "00100010", "00100010", "00100010"],
  ["11001100", "11001100", "00110011", "00110011", "11001100", "11001100", "00110011", "00110011"],
  ["10000001", "11000011", "01100110", "00111100", "00111100", "01100110", "11000011", "10000001"],
  ["00000000", "01100110", "01100110", "00000000", "00011000", "00011000", "00000000", "00000000"],
];
const MODELS = SAMPLES.map(sample => learnConvChain(sample, 3, true));
const REFRESH_INTERVAL_MS = 4000;

export function bindConvChainHero(): () => void {
  const section = document.querySelector<HTMLElement>("[data-convchain-hero]");
  const canvas = section?.querySelector<HTMLCanvasElement>(".hero-convchain");
  if (!section || !canvas) return () => {};
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controller = new AbortController();
  let seed = crypto.getRandomValues(new Uint32Array(1))[0];
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

  const paint = () => {
    frame = null;
    if (!motion.matches) {
      if (performance.now() >= nextRefresh) {
        modelIndex = (modelIndex + 1 + Math.floor(Math.random() * (MODELS.length - 1))) % MODELS.length;
        seed = crypto.getRandomValues(new Uint32Array(1))[0];
        chain = createConvChain(MODELS[modelIndex], chain.size, seed, chain.height);
        nextRefresh = performance.now() + REFRESH_INTERVAL_MS;
        painted = new Uint8Array(0);
      }
      chain.step(512, 1);
    }
    for (let y = 0; y < chain.height; y++) {
      for (let x = 0; x < chain.size; x++) {
        const index = x + y * chain.size;
        if (painted[index] === chain.cells[index]) continue;
        const patch = Math.imul((x >> 3) + 1, 73856093) ^ Math.imul((y >> 3) + 1, 19349663) ^ seed;
        context.fillStyle = chain.cells[index] ? (patch >>> 0) % 4 === 0 ? colors.red : colors.blue : paper;
        context.clearRect(x * cellSize, y * cellSize, cellSize, cellSize);
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        context.strokeStyle = "rgba(0, 0, 0, 0.12)";
        context.lineWidth = 0.6;
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
