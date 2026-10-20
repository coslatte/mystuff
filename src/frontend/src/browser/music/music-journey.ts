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

export function mountMusicJourney() {
  const journey = document.querySelector<HTMLElement>("[data-journey-paths]");
  if (!journey) return;

  let frame: number | null = null;
  let disposed = false;

  const draw = () => {
    frame = null;
    const svg = journey.querySelector("svg");
    const end = journey.querySelector<HTMLElement>("[data-journey-present]");
    if (!svg || !end) return;

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
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    },
    { once: true },
  );
}
