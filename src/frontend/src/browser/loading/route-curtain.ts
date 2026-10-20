import { splashFrame, splashDepth } from "../../lib/loading/frame";
import { interiorEdges } from "../../lib/graphics/recursion/subdivide";

const MIN_HOLD_MS = 600;
const EXIT_MS = 260;
const MAX_HOLD_MS = 15000;

export function mountLoadingPartition(canvas: HTMLCanvasElement, depth = splashDepth): () => void {
  const foundContext = canvas.getContext("2d");
  if (!foundContext) return () => {};
  const context: CanvasRenderingContext2D = foundContext;
  let paper = "", ink = "", blue = "", red = "";
  function readTheme(): void {
    const styles = getComputedStyle(canvas);
    paper = styles.getPropertyValue("--color-brut-bg").trim();
    ink = styles.getPropertyValue("--color-brut-black").trim();
    blue = styles.getPropertyValue("--color-brut-blue").trim();
    red = styles.getPropertyValue("--color-brut-red").trim();
    paint();
  }
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let lastPaint = -Infinity;
  let elapsed = 0;
  let previous = performance.now();

  function paint(): void {
    const { cells, ink: filled } = splashFrame(0, elapsed / 1600, depth);
    const x = (value: number) => Math.round(value * canvas.width);
    const y = (value: number) => Math.round(value * canvas.height);
    context.clearRect(0, 0, canvas.width, canvas.height);
    cells.forEach((cell, index) => {
      context.fillStyle = index % 11 === 3 ? blue : index % 11 === 7 ? red : filled[index] ? ink : paper;
      context.fillRect(x(cell.x0), y(cell.y0), x(cell.x1) - x(cell.x0), y(cell.y1) - y(cell.y0));
    });
    context.fillStyle = paper;
    // Shared boundaries use the same snapped coordinates as the fills.
    for (const edge of interiorEdges(cells)) {
      context.fillRect(x(edge.x1), y(edge.y1), Math.max(1, x(edge.x2) - x(edge.x1)),
        Math.max(1, y(edge.y2) - y(edge.y1)));
    }
  }

  function tick(now: number): void {
    elapsed += Math.min(64, now - previous);
    previous = now;
    if (now - lastPaint >= 1000 / 30) {
      paint();
      lastPaint = now;
    }
    frame = requestAnimationFrame(tick);
  }

  function resume(): void {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = performance.now();
    if (!preference.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resize(): void {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    paint();
  }

  const observer = new ResizeObserver(resize);
  const themeObserver = new MutationObserver(readTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  observer.observe(canvas);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", resume);
  preference.addEventListener("change", resume);
  readTheme();
  resize();
  resume();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    themeObserver.disconnect();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", resume);
    preference.removeEventListener("change", resume);
  };
}

export function startRouteCurtain(): void {
  const foundRoot = document.querySelector<HTMLElement>("[data-route-curtain]");
  const foundLabel = foundRoot?.querySelector<HTMLElement>("[data-route-curtain-label]");
  const foundCanvas = foundRoot?.querySelector<HTMLCanvasElement>("canvas");
  if (!foundRoot || !foundLabel || !foundCanvas) return;
  const root: HTMLElement = foundRoot;
  const label: HTMLElement = foundLabel;
  const canvas: HTMLCanvasElement = foundCanvas;

  let generation = 0;
  let flight: { id: number; started: number; signal: AbortSignal } | null = null;
  let releaseTimer = 0;
  let deadlineTimer = 0;
  let stopAnimation = () => {};

  function lock(locked: boolean): void {
    document.documentElement.classList.toggle("route-locked", locked);
    document.querySelectorAll<HTMLElement>("body > header, body > main, body > footer")
      .forEach(element => { element.inert = locked || document.documentElement.classList.contains("boot-locked"); });
  }

  function clearTimers(): void {
    clearTimeout(releaseTimer);
    clearTimeout(deadlineTimer);
  }

  function release(): void {
    flight = null;
    clearTimers();
    stopAnimation();
    root.dataset.state = "out";
    document.querySelectorAll("[data-nav-pending]").forEach(node => node.removeAttribute("data-nav-pending"));
    releaseTimer = window.setTimeout(() => {
      delete root.dataset.state;
      lock(false);
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXIT_MS);
  }

  function onPreparing(event: DocumentEventMap["astro:before-preparation"]): void {
    if (event.to.pathname === location.pathname && event.to.search === location.search && event.to.hash) {
      if (flight) release();
      return;
    }
    clearTimers();
    stopAnimation();
    const id = ++generation;
    flight = { id, started: performance.now(), signal: event.signal };
    label.textContent = event.to.pathname === "/" ? "index" : event.to.pathname;
    root.dataset.state = "in";
    lock(true);
    if (event.sourceElement instanceof HTMLElement) event.sourceElement.setAttribute("data-nav-pending", "");
    stopAnimation = mountLoadingPartition(canvas, 5);

    // The destination cannot swap before the loading frame has actually painted.
    const loader = event.loader;
    event.loader = async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (event.signal.aborted) return;
      await loader();
    };
    event.signal.addEventListener("abort", () => {
      if (flight?.id === id) release();
    }, { once: true });
    deadlineTimer = window.setTimeout(() => {
      if (flight?.id === id) release();
    }, MAX_HOLD_MS);
  }

  document.addEventListener("astro:before-preparation", onPreparing);
  document.addEventListener("astro:before-swap", event => {
    if (flight) event.newDocument.documentElement.classList.add("route-locked");
  });
  document.addEventListener("astro:after-swap", () => {
    if (flight) lock(true);
  });
  document.addEventListener("astro:page-load", async () => {
    const current = flight;
    if (!current || current.signal.aborted) return;
    const islands = Array.from(document.querySelectorAll("astro-island[ssr]"));
    await Promise.all([
      document.fonts.ready.catch(() => {}),
      ...islands.map(island => new Promise<void>(resolve => {
        island.addEventListener("astro:hydrate", () => resolve(), { once: true, signal: current.signal });
      })),
    ]);
    if (flight?.id !== current.id || current.signal.aborted) return;
    releaseTimer = window.setTimeout(() => {
      if (flight?.id === current.id) release();
    }, Math.max(0, MIN_HOLD_MS - (performance.now() - current.started)));
  });
}
