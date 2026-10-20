import { placeContributionTip } from "../../lib/coding/contribution-tip";

let tip: HTMLElement | null = null;

function hideTip(): void {
  tip?.classList.add("hidden");
}

function bindContributionTip(): void {
  const found = document.querySelector<HTMLElement>("[data-contribution-tip]");
  const grid = document.querySelector<HTMLElement>("[data-contribution-grid]");
  if (!found || !grid || grid.dataset.tipBound) return;
  grid.dataset.tipBound = "true";
  tip = found;

  grid.addEventListener("pointerover", (event) => {
    const cell = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-tip]")
      : null;
    if (!cell || !tip) return;
    tip.textContent = cell.dataset.tip ?? "";
    tip.classList.remove("hidden");
    const { left, top } = placeContributionTip(
      cell.getBoundingClientRect(),
      tip.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
  grid.addEventListener("pointerleave", hideTip);
}

bindContributionTip();
document.addEventListener("astro:page-load", bindContributionTip);
// The chart scrolls under the pointer, and a tap outside the grid has to dismiss the tip.
window.addEventListener("scroll", hideTip, true);
window.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest("[data-tip]")) hideTip();
});

document.addEventListener("astro:before-swap", () => {
  hideTip();
  tip = null;
});
