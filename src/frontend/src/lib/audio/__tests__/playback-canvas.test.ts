import assert from "node:assert/strict";
import { test } from "node:test";
import { spectrumColor } from "../spectrum";

test("spectrum colors follow dB anchors and interpolate between them", () => {
  for (const [db, color] of [
    [-Infinity, "rgb(255, 255, 255)"],
    [-120, "rgb(255, 255, 255)"],
    [-80, "rgb(210, 170, 255)"],
    [-40, "rgb(125, 145, 255)"],
    [-10, "rgb(255, 140, 155)"],
    [0, "rgb(255, 255, 255)"],
    [-100, "rgb(233, 213, 255)"],
    [-60, "rgb(168, 158, 255)"],
    [-25, "rgb(190, 143, 205)"],
    [-5, "rgb(255, 198, 205)"],
  ] satisfies [number, string][]) {
    assert.equal(spectrumColor(db), color, `${db} dB`);
  }
  assert.equal(spectrumColor(-200), spectrumColor(-Infinity));
  assert.equal(spectrumColor(10), spectrumColor(0));
});
