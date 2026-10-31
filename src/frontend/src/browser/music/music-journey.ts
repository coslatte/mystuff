type Point = { x: number; y: number };

function curveThrough(points: Point[]) {
  const [first, ...rest] = points;
  if (!first) return "";
  let path = `M${first.x} ${first.y}`;
  let previous = first;

  for (const point of rest) {
    const bend = (point.y - previous.y) / 2;
    path += ` C${previous.x} ${previous.y + bend} ${point.x} ${point.y - bend} ${point.x} ${point.y}`;
    previous = point;
  }

  return path;
}

const mounted = new WeakSet<HTMLElement>();

export function mountMusicJourney() {
  const journey = document.querySelector<HTMLElement>("[data-journey-paths]");
  if (!journey || mounted.has(journey)) return;
  mounted.add(journey);

  let frame: number | null = null;
  let disposed = false;
  let motionFrame: number | null = null;
  const lifecycle = new AbortController();
  const motion = matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  const chapters = [...journey.querySelectorAll<HTMLElement>(".journey-chapter, .journey-present")];
  const paths = [...journey.querySelectorAll<SVGPathElement>(".journey-lines path")];
  const lengths = new Map<SVGPathElement, number>();
  const updateMotion = () => {
    motionFrame = null;
    journey.classList.toggle("journey-scroll-motion", motion.matches);
    if (!motion.matches || journey.getClientRects().length === 0) return;
    const readingLine = innerHeight * 0.8;
    chapters.forEach(chapter => {
      const progress = Math.max(0, Math.min(1, (readingLine - chapter.getBoundingClientRect().top) / (innerHeight * 0.35)));
      chapter.style.setProperty("--chapter-entry", String(progress));
    });
    const target = readingLine - journey.getBoundingClientRect().top;
    paths.forEach(path => {
      const length = lengths.get(path);
      if (!length) return;
      let low = 0;
      let high = length;
      for (let step = 0; step < 12; step++) {
        const middle = (low + high) / 2;
        if (path.getPointAtLength(middle).y < target) low = middle;
        else high = middle;
      }
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length - (low + high) / 2);
    });
  };
  const scheduleMotion = () => {
    if (!disposed && motionFrame === null) motionFrame = requestAnimationFrame(updateMotion);
  };
  window.addEventListener("scroll", scheduleMotion, { passive: true, signal: lifecycle.signal });
  window.addEventListener("resize", scheduleMotion, { signal: lifecycle.signal });
  motion.addEventListener("change", scheduleMotion, { signal: lifecycle.signal });
  document.querySelector("[data-music-views]")?.addEventListener("music:view-change", () => {
    scheduleDraw();
    scheduleMotion();
  }, { signal: lifecycle.signal });

  const draw = () => {
    frame = null;
    const svg = journey.querySelector("svg");
    const end = journey.querySelector<HTMLElement>("[data-journey-present]");
    if (!svg || !end || journey.getClientRects().length === 0) return;

    const bounds = journey.getBoundingClientRect();
    const center = (element: Element): Point => {
      const box = element.getBoundingClientRect();
      return {
        x: box.left + box.width / 2 - bounds.left,
        y: box.top + box.height / 2 - bounds.top,
      };
    };
    const destination = center(end);
    svg.setAttribute(
      "viewBox",
      `0 0 ${journey.clientWidth} ${journey.clientHeight}`,
    );

    const root: Point[] = [];
    let electronicThread: Point | undefined;
    for (const moment of journey.querySelectorAll(".journey-moment")) {
      const anchor = moment.querySelector('[data-journey-node="root"]');
      const discovery = moment.querySelector('[data-journey-node="discovery"]');
      if (anchor) {
        electronicThread = center(anchor);
        root.push(electronicThread);
      } else if (electronicThread && discovery) {
        root.push({ x: electronicThread.x, y: center(discovery).y });
      }
    }

    const discoveries = [
      ...journey.querySelectorAll('[data-journey-node="discovery"]'),
    ].map(center);
    svg
      .querySelector(".root-line")
      ?.setAttribute("d", curveThrough([...root, destination]));
    svg
      .querySelector(".discovery-line")
      ?.setAttribute("d", curveThrough([...discoveries, destination]));
    paths.forEach(path => lengths.set(path, path.getTotalLength()));
    scheduleMotion();
  };

  const scheduleDraw = () => {
    if (!disposed && frame === null) frame = requestAnimationFrame(draw);
  };
  const observer = new ResizeObserver(scheduleDraw);
  observer.observe(journey);
  journey
    .querySelectorAll(".journey-chapter, .moment-period, .journey-present")
    .forEach((element) => observer.observe(element));
  scheduleDraw();
  document.fonts.ready.then(scheduleDraw);
  document.addEventListener(
    "astro:before-swap",
    () => {
      disposed = true;
      lifecycle.abort();
      if (motionFrame !== null) cancelAnimationFrame(motionFrame);
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    },
    { once: true },
  );
}
