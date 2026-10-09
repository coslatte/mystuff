/*
 * Boot controller.
 *
 * Owns everything the splash does that is not pixels or markup: deciding whether
 * it should appear at all, turning browser signals into a percentage, driving the
 * bar, and getting out of the way when the page is ready.
 *
 * Written as a plain module rather than a React hook because the splash must
 * never be a reason to ship react-dom: it is shown on `/`, which has no island at
 * all. The footer widget made the same trade with a custom element, and
 * `NowPlaying.astro` shows the call shape.
 *
 * The lifecycle is a three-phase machine, because each phase needs a different
 * kind of clock and mixing them up is how a splash ends up freezing or never
 * leaving:
 *
 *   waiting  -> adaptive delay, decides whether to appear at all
 *   running  -> milestone signals, counter, hard deadline
 *   closing  -> ramp to 100, settle, teardown
 */

import { readSessionText, writeSessionText } from "../storage";
import {
  creepToward,
  markMilestone,
  rampFrom,
  toPercent,
  type BootMilestone,
  type ProgressState,
} from "./progress";

const SEEN_KEY = "clm_boot_seen";

/**
 * Nothing is shown before this.
 *
 * A warm cache can paint the whole page inside 300ms. Revealing the splash for
 * that long is not reassuring, it is a flash, so the splash waits, then checks
 * whether the page already finished and skips itself if it did.
 */
const ADAPTIVE_DELAY_MS = 400;

/** How long the counter takes to travel from its last milestone up to 100. */
const RAMP_MS = 320;

/** Settle time on 100 before the overlay leaves, so the number is seen arriving. */
const SETTLE_MS = 160;

/**
 * Hard ceiling on the splash, measured from the moment it starts waiting.
 *
 * Without this a single stalled image, or a font request that never resolves,
 * would keep the overlay over a page the user can already read. Past the deadline
 * the splash reports 100 and leaves regardless of what is still outstanding.
 */
const MAX_HOLD_MS = 4000;

/**
 * A run whose milestones come from a script instead of from the browser.
 *
 * The real lifecycle listens for signals that, on a page already loaded, have
 * all fired by the time the overlay is revealed. Feeding it those signals would
 * only ever show the closing ramp. Replaying a fixed schedule is what makes the
 * whole animation watchable, which is all `/loading` needs.
 */
export type BootReplay = {
  /** Milestone offsets in ms from the moment the overlay is revealed. */
  milestones: ReadonlyArray<readonly [BootMilestone, number]>;
  /** Fires once a run has fully torn down, so the caller can start another. */
  onExit?: () => void;
};

export type StartBootScreenOptions = {
  /**
   * Replay driver. Reachable only from `/loading`; a normal page takes the
   * browser-signal path.
   */
  replay?: BootReplay;
};

type Elements = {
  root: HTMLElement;
  /** The square container the canvas and the static frame share. */
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  percent: HTMLElement;
  bar: HTMLElement;
  /** The CSS composition that holds the frame until three.js resolves. */
  fallback: HTMLElement;
  stage: HTMLElement;
};

/**
 * Text for each milestone.
 *
 * A bare percentage is meaningless to a screen reader and vague to a sighted user
 * anyway, so the splash says what it is waiting for.
 */
const STAGE_COPY: Record<BootMilestone, string> = {
  painted: "waking up",
  dom: "reading the page",
  fonts: "loading fonts",
  islands: "starting the parts that move",
  assets: "finishing the pictures",
};

/**
 * Whether this visit should show the splash at all.
 *
 * Two independent reasons to say no, and both are needed:
 *
 * - Already seen in this tab session. Someone who navigated from `/` to `/music`
 *   twenty seconds later has no reason to watch it again, and on `/music` they are
 *   about to wait on the API cold start, which the splash must not pretend to
 *   cover.
 * - The page turned out to be fast, which the adaptive delay decides by asking the
 *   document rather than by inspecting the HTTP cache. Cache inspection would
 *   depend on response headers this project does not control.
 */
function shouldShow(): boolean {
  if (readSessionText(SEEN_KEY)) return false;
  return document.readyState !== "complete";
}

function query(root: ParentNode): Elements | null {
  const find = <T extends Element>(selector: string): T | null => root.querySelector<T>(selector);
  const found = {
    root: find<HTMLElement>("[data-boot-screen]"),
    frame: find<HTMLElement>("[data-boot-frame]"),
    canvas: find<HTMLCanvasElement>("[data-boot-canvas]"),
    percent: find<HTMLElement>("[data-boot-percent]"),
    bar: find<HTMLElement>("[data-boot-bar]"),
    fallback: find<HTMLElement>("[data-boot-fallback]"),
    stage: find<HTMLElement>("[data-boot-stage]"),
  };
  return Object.values(found).every((node) => node !== null) ? (found as Elements) : null;
}

/**
 * Starts the splash.
 *
 * The returned teardown is idempotent and safe at any point, including before the
 * splash has appeared and after it has left.
 */
export function startBootScreen({ replay }: StartBootScreenOptions = {}): () => void {
  const found = query(document);
  if (!found) return () => {};
  // Re-bound to a non-nullable name: a `const` narrowed by a guard still widens
  // back to `Elements | null` inside the closures below, which is most of this file.
  const elements: Elements = found;
  /** A pristine second overlay, so a replayed run leaves one behind to reuse. */
  const spare = replay ? elements.root.cloneNode(true) : null;

  let sceneRelease = () => {};
  const listeners: Array<() => void> = [];
  const timers: number[] = [];
  let frame = 0;
  let waitTimer = 0;
  let finished = false;

  function finish(): void {
    if (finished) return;
    finished = true;

    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = 0;
    for (const id of timers) clearTimeout(id);
    timers.length = 0;
    for (const off of listeners) off();
    listeners.length = 0;

    sceneRelease();

    if (spare) elements.root.replaceWith(spare);
    else elements.root.remove();
    // The overlay locks scrolling while it is up, so without this the page behind
    // it would stay frozen after the splash left.
    document.documentElement.classList.remove("boot-locked");
    // Recorded on every exit, including the abort path: a navigation away mid-load
    // has still shown the splash, and the next page should not show it again. A
    // replay is not a visit, so it leaves the session alone.
    if (!replay) writeSessionText(SEEN_KEY, "1");
    replay?.onExit?.();
  }

  if (!replay && !shouldShow()) {
    finish();
    return finish;
  }

  /** Zero until the splash is revealed, so it is timed from the moment it becomes
      visible rather than from module evaluation. */
  let started = 0;
  let deadline = Infinity;

  let state: ProgressState = { earned: 0 };
  /** Non-zero once the counter starts travelling to 100. */
  let closingAt = 0;
  let closingFrom = 0;
  let teardownAt = Infinity;

  function report(milestone: BootMilestone): void {
    const next = markMilestone(state, milestone);
    if (next === state) return;
    state = next;
    const copy = STAGE_COPY[milestone];
    if (elements.stage.textContent !== copy) {
      elements.stage.textContent = copy;
      // The progressbar is the only thing assistive tech announces, so the stage
      // travels with the value. A bare "42" would not say what it is waiting for.
      elements.root.setAttribute("aria-valuetext", copy);
    }
    if (state.earned >= 100) beginClosing();
  }

  function beginClosing(): void {
    if (closingAt > 0) return;
    closingAt = performance.now();
    closingFrom = state.earned;
  }

  function render(percent: number): void {
    elements.percent.textContent = `${percent}%`;
    elements.bar.style.setProperty("--boot-progress", `${percent}%`);
    elements.root.setAttribute("aria-valuenow", String(percent));
  }

  function paint(): void {
    const now = performance.now();

    if (now >= teardownAt) {
      finish();
      return;
    }

    if (closingAt === 0 && now >= deadline) {
      // The deadline takes the same path a fully loaded page takes, so the closing
      // animation is identical whether the page was ready or the wait ran out.
      state = { earned: 100 };
      elements.stage.textContent = STAGE_COPY.assets;
      elements.root.setAttribute("aria-valuetext", STAGE_COPY.assets);
      beginClosing();
    }

    let value: number;
    if (closingAt > 0) {
      value = rampFrom(closingFrom, (now - closingAt) / RAMP_MS);
      if (value >= 100) {
        render(100);
        // Hold on 100 briefly, then leave, so the counter is seen arriving instead
        // of vanishing mid-flight.
        if (teardownAt === Infinity) teardownAt = now + SETTLE_MS;
        frame = requestAnimationFrame(paint);
        return;
      }
    } else {
      // Creeps toward the next milestone so a large image cannot leave the number
      // looking frozen, while the ceiling keeps it from claiming credit it has not
      // earned.
      value = creepToward(state.earned, now - started);
    }

    render(toPercent(state.earned, value));
    frame = requestAnimationFrame(paint);
  }

  function on(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  render(0);

  // Milestone wiring. `arm` defers registration until the adaptive delay elapses,
  // so a splash that decides to skip itself never attached a single listener and
  // never started a frame loop.
  function arm(): void {
    // Reveal only now, and only from here. Gating visibility on a class added in
    // the document head would mean a bundle that fails to load leaves the overlay
    // covering the site forever; this way the splash is invisible until the code
    // that also knows how to remove it is running.
    elements.root.dataset.state = "active";
    document.documentElement.classList.add("boot-locked");

    started = performance.now();
    // A replay owns its own clock, so the cold-start ceiling has nothing to catch
    // and would otherwise cut a scripted run short.
    deadline = replay ? Infinity : started + MAX_HOLD_MS;
    frame = requestAnimationFrame(paint);

    if (replay) {
      for (const [milestone, at] of replay.milestones) {
        timers.push(window.setTimeout(() => report(milestone), at));
      }
    } else {
      // `astro:page-load` never fires on a page with no island to hydrate, so a page
      // without one reports the milestone itself. Only /music and /admin have islands.
      if (document.querySelector("astro-island")) {
        on(document, "astro:page-load", () => report("islands"), { once: true });
      } else {
        report("islands");
      }

      if (document.readyState === "loading") {
        on(document, "DOMContentLoaded", () => report("dom"), { once: true });
      } else {
        report("dom");
      }

      on(document, "load", () => report("assets"), { once: true });

      // `fonts.ready` can reject if the font face set is replaced mid-load, and it
      // resolves late on a cold connection. Neither is allowed to escape; the
      // deadline covers the case where it simply never settles.
      const fonts = document.fonts;
      if (fonts) {
        fonts.ready.then(
          () => report("fonts"),
          () => report("fonts")
        );
      }
    }

    // A background tab stops requestAnimationFrame entirely, so the counter would
    // freeze and the overlay would never close. Returning to the tab is a reliable
    // nudge, and a replay needs it as much as a real load does.
    on(document, "visibilitychange", () => {
      if (document.visibilityState === "visible" && closingAt === 0) beginClosing();
    });

    // ClientRouter swaps the body without a document load, which would leave the
    // overlay stranded over a page the user is already navigating to.
    on(document, "astro:before-swap", () => beginClosing(), { once: true });

    report("painted");
  }

  // The adaptive wait. The splash exists for slow loads, so it measures first and
  // skips itself when the page turns out to be fast. A replay has already decided
  // that it wants the splash, so there is nothing left to measure.
  if (replay) {
    arm();
  } else {
    waitTimer = window.setTimeout(() => {
      waitTimer = 0;
      if (document.readyState === "complete") {
        finish();
        return;
      }
      arm();
    }, ADAPTIVE_DELAY_MS);
  }

  // The three.js scene is imported dynamically so the bundle lands in its own chunk
  // and never blocks the first paint, the counter, or the dismissal. Skipped under
  // reduced motion, where the static CSS frame is the answer.
  if (!prefersReducedMotion) {
    void import("../three/splash-scene")
      .then(({ mountSplashScene }) => {
        // The chunk can resolve after the splash is already gone; mounting a
        // scene into a removed canvas would leak a running render loop.
        if (finished) return;
        const scene = mountSplashScene(elements.canvas, elements.root);
        if (!scene || finished) return;
        sceneRelease = scene.release;
        // The stage owns the swap state, which is what crossfades the static frame
        // out and the canvas in.
        elements.frame.dataset.state = "swapped";
      })
      .catch(() => {
        // No WebGL, a blocked chunk, or a failed navigation. The CSS frame is
        // still on screen, so this costs motion, not content.
      });
  }

  return finish;
}
