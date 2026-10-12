import assert from "node:assert/strict";
import { test } from "node:test";
import { FM_WAVE_CYCLE_MS, buildFmWavePath, modulatorFrequency } from "./fm-wave";

test("the modulator sweeps up and down over one slow cycle", () => {
  assert.equal(modulatorFrequency(0), 1);
  assert.equal(modulatorFrequency(FM_WAVE_CYCLE_MS / 4), 1.4);
  assert.equal(modulatorFrequency((FM_WAVE_CYCLE_MS * 3) / 4), 0.6);
  assert.equal(buildFmWavePath(0), buildFmWavePath(FM_WAVE_CYCLE_MS));
  assert.notEqual(buildFmWavePath(0), buildFmWavePath(FM_WAVE_CYCLE_MS / 4));
});
