import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FM_WAVE_CYCLE_MS,
  FM_WAVE_SCROLL_MS,
  buildFmWavePath,
  fmWaveOffset,
  fmWaveY,
  modulatorFrequency,
} from "./fm-wave";

const close = (left: number, right: number): void => {
  assert.ok(Math.abs(left - right) < 1e-9, `${left} is not ${right}`);
};

test("the modulator sweeps up and down over one slow cycle", () => {
  close(modulatorFrequency(0), 2);
  close(modulatorFrequency(FM_WAVE_CYCLE_MS / 4), 2.8);
  close(modulatorFrequency((FM_WAVE_CYCLE_MS * 3) / 4), 1.2);
  assert.equal(buildFmWavePath(0, 0), buildFmWavePath(FM_WAVE_CYCLE_MS, 0));
  assert.notEqual(buildFmWavePath(0, 0), buildFmWavePath(FM_WAVE_CYCLE_MS / 4, 0));
});

test("the curve is frequency modulated, not a detuned sine", () => {
  // The modulator takes two cycles per box at the cycle start, so the curve repeats
  // at every half box. A phase ramp would drift instead of repeat.
  for (const x of [0.05, 0.3, 0.7, 0.95]) {
    close(fmWaveY(x + 0.5, 0, 0), fmWaveY(x, 0, 0));
  }
});

test("the wave scrolls right at a steady pace", () => {
  assert.equal(fmWaveOffset(0), 0);
  close(fmWaveOffset(FM_WAVE_SCROLL_MS), 0.5);
  close(fmWaveOffset(FM_WAVE_SCROLL_MS / 2), 0.25);
  assert.notEqual(buildFmWavePath(0, 0), buildFmWavePath(0, fmWaveOffset(FM_WAVE_SCROLL_MS / 2)));

  for (const x of [0.25, 0.6, 0.9]) {
    close(fmWaveY(x, 0, 0.05), fmWaveY(x - 0.05, 0, 0));
  }
});
