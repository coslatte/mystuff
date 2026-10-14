/*
 * The per-day label and placement for the `/coding` contribution calendar.
 *
 * Framework-free and side-free: the label is rendered into each cell during SSR
 * and the placement runs in the browser, so both halves stay testable.
 */

export interface TipBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

const GAP = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** GitHub's wording, so hovering a cell reads like it does on the profile. */
export function contributionTip(count: number, date: string): string {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  if (count === 0) return `No contributions on ${day}`;
  return `${count} contribution${count === 1 ? "" : "s"} on ${day}`;
}

/**
 * Centres the tip over the cell, above it when the viewport allows and below it
 * when the cell sits in the top rows. Both axes clamp, because the first and
 * last week are at the edges of the scrollable chart.
 */
export function placeContributionTip(
  anchor: TipBox,
  tip: TipBox,
  viewportWidth: number,
  viewportHeight: number
): { left: number; top: number } {
  const left = clamp(
    anchor.left + anchor.width / 2 - tip.width / 2,
    GAP,
    viewportWidth - tip.width - GAP
  );
  const above = anchor.top - tip.height - GAP;
  const below = anchor.top + anchor.height + GAP;
  const top = clamp(above >= GAP ? above : below, GAP, viewportHeight - tip.height - GAP);
  return { left, top };
}