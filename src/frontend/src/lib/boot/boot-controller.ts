import { mountLoadingPartition } from "../route-curtain";
import {
  creepToward,
  markMilestone,
  rampFrom,
  toPercent,
  type BootMilestone,
  type ProgressState,
} from "./progress";

const RAMP_MS = 320;
const SETTLE_MS = 160;
const MIN_HOLD_MS = 600;
const MAX_HOLD_MS = 4000;

export type BootReplay = {
  milestones: ReadonlyArray<readonly [BootMilestone, number]>;
  onExit?: () => void;
};

export type StartBootScreenOptions = {
  replay?: BootReplay;
};

const STAGE_COPY: Record<BootMilestone, string> = {
  painted: "waking up",
  dom: "reading the page",
  fonts: "loading fonts",
  islands: "starting the parts that move",
  assets: "finishing the pictures",
};

export function startBootScreen({ replay }: StartBootScreenOptions = {}): () => void {
  const foundRoot = document.querySelector<HTMLElement>("[data-boot-screen]");
  const foundCanvas = foundRoot?.querySelector<HTMLCanvasElement>("[data-boot-canvas]");
  const foundPercent = foundRoot?.querySelector<HTMLElement>("[data-boot-percent]");
  const foundBar = foundRoot?.querySelector<HTMLElement>("[data-boot-bar]");
  const foundStage = foundRoot?.querySelector<HTMLElement>("[data-boot-stage]");
  if (!foundRoot || !foundCanvas || !foundPercent || !foundBar || !foundStage) return () => {};
  const root: HTMLElement = foundRoot;
  const canvas: HTMLCanvasElement = foundCanvas;
  const percent: HTMLElement = foundPercent;
  const bar: HTMLElement = foundBar;
  const stage: HTMLElement = foundStage;

  const spare = replay ? root.cloneNode(true) : null;
  const listeners: Array<() => void> = [];
  const timers: number[] = [];
  const milestones = new Set<BootMilestone>();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const started = performance.now();
  let stopAnimation = () => {};
  let frame = 0;
  let finished = false;
  let state: ProgressState = { earned: 0 };
  let closingAt: number | null = null;
  let closingFrom = 0;
  let teardownAt = Infinity;

  function finish(notifyReplay = true): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    listeners.forEach(off => off());
    stopAnimation();
    if (spare) root.replaceWith(spare);
    else root.remove();
    document.documentElement.classList.remove("boot-locked");
    document.documentElement.removeAttribute("data-boot-pending");
    document.querySelectorAll<HTMLElement>("body > header, body > main, body > footer")
      .forEach(element => { element.inert = document.documentElement.classList.contains("route-locked"); });
    if (notifyReplay) replay?.onExit?.();
  }

  function beginClosing(): void {
    if (closingAt !== null || finished) return;
    closingAt = Math.max(performance.now(), started + (reducedMotion ? 100 : MIN_HOLD_MS));
    closingFrom = state.earned;
  }

  function report(milestone: BootMilestone): void {
    if (finished) return;
    milestones.add(milestone);
    state = markMilestone(state, milestone);
    state = { earned: Math.min(92, state.earned) };
    stage.textContent = STAGE_COPY[milestone];
    root.setAttribute("aria-valuetext", STAGE_COPY[milestone]);
    if (milestones.size === 5) beginClosing();
  }

  function render(value: number): void {
    percent.textContent = `${value}%`;
    bar.style.setProperty("--boot-progress", `${value}%`);
    root.setAttribute("aria-valuenow", String(value));
  }

  function paint(now: number): void {
    if (finished) return;
    if (now >= teardownAt) {
      finish();
      return;
    }
    if (closingAt === null || now < closingAt) {
      render(toPercent(state.earned, creepToward(state.earned, now - started)));
    } else {
      const value = rampFrom(closingFrom, (now - closingAt) / RAMP_MS);
      render(toPercent(closingFrom, value));
      if (value >= 100 && teardownAt === Infinity) teardownAt = now + SETTLE_MS;
    }
    frame = requestAnimationFrame(paint);
  }

  function on(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler, { once: true });
    listeners.push(() => target.removeEventListener(type, handler));
  }

  root.dataset.state = "active";
  document.documentElement.classList.add("boot-locked");
  document.querySelectorAll<HTMLElement>("body > header, body > main, body > footer")
    .forEach(element => { element.inert = true; });
  if (canvas.getContext("2d")) {
    stopAnimation = mountLoadingPartition(canvas);
    root.querySelector<HTMLElement>("[data-boot-frame]")?.setAttribute("data-state", "swapped");
  }
  render(0);
  frame = requestAnimationFrame(paint);
  report("painted");

  if (replay) {
    for (const [milestone, at] of replay.milestones) {
      timers.push(window.setTimeout(() => report(milestone), at));
    }
  } else {
    if (document.readyState === "loading") on(document, "DOMContentLoaded", () => report("dom"));
    else report("dom");

    if (document.readyState === "complete") report("assets");
    else on(window, "load", () => report("assets"));

    document.fonts.ready.then(() => report("fonts"), () => report("fonts"));

    const islands = Array.from(document.querySelectorAll("astro-island[ssr]"));
    if (islands.length === 0) report("islands");
    else {
      let remaining = islands.length;
      for (const island of islands) {
        on(island, "astro:hydrate", () => {
          remaining--;
          if (remaining === 0) report("islands");
        });
      }
    }
    timers.push(window.setTimeout(beginClosing, MAX_HOLD_MS));
    // An inactive tab suspends animation frames; this timeout still releases the page.
    timers.push(window.setTimeout(finish, MAX_HOLD_MS + RAMP_MS + SETTLE_MS + MIN_HOLD_MS));
  }

  on(document, "astro:before-swap", () => {
    // A replay must not schedule its next run against the new route.
    finish(false);
  });
  return finish;
}
