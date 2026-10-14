import assert from "node:assert/strict";
import { test } from "node:test";
import { contributionTip, placeContributionTip } from "./contribution-tip";

test("the label states the day's count and date", () => {
  assert.equal(contributionTip(7, "2025-12-01"), "7 contributions on December 1, 2025");
  assert.equal(contributionTip(1, "2025-12-01"), "1 contribution on December 1, 2025");
  assert.equal(contributionTip(0, "2025-12-01"), "No contributions on December 1, 2025");
});

test("the tip sits above the cell and clears the viewport edges", () => {
  const tip = { top: 0, left: 0, width: 120, height: 24 };
  const middle = placeContributionTip({ top: 200, left: 400, width: 12, height: 12 }, tip, 1000, 800);
  assert.equal(middle.top, 168);
  assert.equal(middle.left, 346);

  const lastWeek = placeContributionTip({ top: 200, left: 985, width: 12, height: 12 }, tip, 1000, 800);
  assert.equal(lastWeek.left, 872);
  assert.ok(lastWeek.top >= 8);
});

test("a cell too close to the top flips the tip below", () => {
  const tip = { top: 0, left: 0, width: 120, height: 24 };
  const flipped = placeContributionTip({ top: 6, left: 400, width: 12, height: 12 }, tip, 1000, 800);
  assert.equal(flipped.top, 26);
});