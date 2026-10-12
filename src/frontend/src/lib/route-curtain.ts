/*
 * Route curtain.
 *
 * `ClientRouter` fetches the next document with nothing on screen to say so. On a
 * prerendered route served from cache that gap is short enough to read as
 * instant; on `/coding` (an SSR function, GitHub behind it) or `/music` (client
 * fetch against a cold Spring Boot) it is long enough to read as a hang. This
 * owns that gap, and it splits the answer in two because one signal cannot
 * cover both ends of it:
 *
 *   0ms   the link that was clicked washes yellow. Instant, and it points at the
 *         thing that was asked for, which is what makes the wait legible rather
 *         than just visible.
 *   300ms if the fetch is still out, a partition curtain blooms out of the click
 *         and names the destination.
 *
 * The split is the same adaptive-delay argument `boot-controller.ts` makes for
 * the splash, and for the same reason: a curtain that flashed for the 80ms of a
 * warm navigation would be a worse experience than no curtain at all. Reveal the
 * curtain early and the site starts strobing; never reveal it and the slow case
 * is unfixed. 300ms is where a wait stops reading as instant.
 *
 * Plain module rather than an island, because this runs on `/`, which ships no
 * react-dom at all. Same trade `lib/morphling-cursor.ts` and the splash make.
 */

import { splashFrame } from "./boot/frame";

/** How long a navigation may run before the curtain covers the page. */
const SHOW_DELAY_MS = 300;

/** Hard ceiling on the curtain. The router can abandon a navigation without
 *  firing `astro:after-swap` — a cancelled `before-preparation`, a failed fetch
 *  that falls back to a full page load — and the one thing this overlay must
 *  never do is stay up over a page that has finished loading. */
const MAX_HOLD_MS = 4000;

type Elements = {
  root: HTMLElement;
  label: HTMLElement;
  cells: HTMLElement[];
};

function query(root: ParentNode): Elements | null {
  const curtain = root.querySelector<HTMLElement>("[data-route-curtain]");
  const label = root.querySelector<HTMLElement>("[data-route-curtain-label]");
  const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-route-curtain-cell]"));
  if (!curtain || !label || cells.length === 0) return null;
  return { root: curtain, label, cells };
}

/**
 * Scales the bloom so it starts at the click and not at the viewport centre.
 *
 * Every cell delays in proportion to how far it is from the pointer, which is
 * what makes the curtain read as coming out of the link rather than appearing
 * from nowhere. Written once per navigation, so the cost is eight style writes.
 */
function bloomFrom(cells: HTMLElement[], origin: { x: number; y: number }): void {
  const distances = cells.map((cell) => {
    const box = cell.getBoundingClientRect();
    return Math.hypot(
      box.left + box.width / 2 - origin.x,
      box.top + box.height / 2 - origin.y
    );
  });
  const longest = Math.max(...distances);
  if (longest === 0) return;

  cells.forEach((cell, index) => {
    const distance = distances[index] ?? 0;
    // Square root so the near cells do not all fire together and the far ones do
    // not all fire at the end.
    cell.style.setProperty("--bloom-delay", `${Math.round((distance / longest) ** 0.6 * 420)}ms`);
  });
}

export function startRouteCurtain(): void {
  const found = query(document);
  if (!found) return;
  const { root, label, cells } = found;

  let revealTimer = 0;
  let releaseTimer = 0;
  let origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function clearTimers(): void {
    if (revealTimer) window.clearTimeout(revealTimer);
    if (releaseTimer) window.clearTimeout(releaseTimer);
    revealTimer = 0;
    releaseTimer = 0;
  }

  /**
   * Takes the curtain down.
   *
   * Falls back to a timeout instead of `transitionend` because the curtain can be
   * mid-flight when the page swaps, and a transition that is cancelled by a
   * re-render never fires the event that would have cleaned it up.
   */
  function release(): void {
    if (!root.dataset.state) return;
    root.dataset.state = "out";
    clearTimers();
    releaseTimer = window.setTimeout(() => {
      delete root.dataset.state;
    }, 320);
  }

  function onPreparing(event: DocumentEventMap["astro:before-preparation"]): void {
    const { to, sourceElement } = event;

    // First, because a hash jump still dispatches this event: it must cancel a
    // pending reveal rather than leaving the previous navigation's timer to fire
    // over an already-visible section.
    clearTimers();

    // A same-page hash jump never fetches anything, so there is nothing to wait
    // for and a curtain over it is pure noise.
    if (to.pathname === location.pathname && to.hash) return;

    if (sourceElement instanceof HTMLElement) {
      sourceElement.setAttribute("data-nav-pending", "");
      const box = sourceElement.getBoundingClientRect();
      // The midpoint of the link, not the pointer: keyboard navigation has no
      // pointer, and this is where the link is either way.
      origin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }

    revealTimer = window.setTimeout(() => {
      // The router can be replaced by a full page load between the click and the
      // timer firing (a failed fetch falls back to `location.href`). In that case
      // this document is already gone and showing the curtain is a no-op.
      if (!document.body.contains(root)) return;

      label.textContent = to.pathname === "/" ? "index" : to.pathname;
      // `mount` first, then measure. The curtain is `display: none` until it
      // carries a `data-state`, and a cell inside a `display: none` subtree
      // reports a zero rect — measuring before mounting collapses every cell to
      // the same distance and the bloom degenerates to a plain fade.
      root.dataset.state = "mount";
      bloomFrom(cells, origin);
      requestAnimationFrame(() => {
        if (root.dataset.state === "mount") root.dataset.state = "in";
      });
    }, SHOW_DELAY_MS);

    // A navigation that never reaches the swap must not leave the overlay up.
    releaseTimer = window.setTimeout(release, MAX_HOLD_MS);
  }

  function onSwap(): void {
    document.querySelectorAll("[data-nav-pending]").forEach((node) => {
      node.removeAttribute("data-nav-pending");
    });
    clearTimers();
    release();
  }

  document.addEventListener("astro:before-preparation", onPreparing);
  document.addEventListener("astro:after-swap", onSwap);
  // The pointer position is what the bloom emanates from, so it has to be
  // sampled before the click reaches the router's own handler.
  document.addEventListener(
    "pointerdown",
    (event) => {
      origin = { x: event.clientX, y: event.clientY };
    },
    { capture: true }
  );
}

/**
 * The partition, generated once per page load.
 *
 * Beat 0 is the splash's opening frame, shared deliberately: the curtain that
 * covers a slow navigation is the same composition the site opens with, at
 * viewport scale instead of square. Both read from one function so they cannot
 * drift into looking like two different ideas.
 */
export const curtainCells = () => splashFrame(0);