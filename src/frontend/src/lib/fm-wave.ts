export const FM_WAVE_CYCLE_MS = 32_000;
export const FM_WAVE_SCROLL_MS = 12_000;

// The masked box is twice the word and the wave scrolls through its visible half,
// so every count below is per box: one period is one word, the carrier fits it three
// times and the modulator once or so.
const CARRIER_CYCLES = 6;
const MODULATOR_CENTER = 2;
const MODULATOR_DEVIATION = 0.8;
const MODULATION_INDEX = 1.2;
const SCROLL_PERIOD = 0.5;
const AMPLITUDE = 0.36;
const SAMPLE_COUNT = 128;

export function modulatorFrequency(elapsedMs: number): number {
  return MODULATOR_CENTER
    + MODULATOR_DEVIATION * Math.sin((elapsedMs / FM_WAVE_CYCLE_MS) * Math.PI * 2);
}

export function fmWaveOffset(elapsedMs: number): number {
  return (elapsedMs / FM_WAVE_SCROLL_MS) * SCROLL_PERIOD;
}

export function fmWaveY(x: number, elapsedMs: number, offset: number): number {
  // Minus, so a growing offset carries the crests to the right.
  const sample = x - offset;
  const carrierPhase = Math.PI * 2 * CARRIER_CYCLES * sample;
  const modulationPhase = (elapsedMs / FM_WAVE_CYCLE_MS) * Math.PI * 2;
  const modulation = MODULATION_INDEX
    * Math.sin(Math.PI * 2 * modulatorFrequency(elapsedMs) * sample + modulationPhase);
  return 0.5 - AMPLITUDE * Math.sin(carrierPhase + modulation);
}

export function buildFmWavePath(elapsedMs: number, offset: number): string {
  let path = "";

  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const x = index / SAMPLE_COUNT;
    path += `${index === 0 ? "M" : " L"}${x.toFixed(4)} ${fmWaveY(x, elapsedMs, offset).toFixed(4)}`;
  }

  return `${path} L1 1 L0 1 Z`;
}
