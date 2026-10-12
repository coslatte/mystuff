export const FM_WAVE_CYCLE_MS = 32_000;

const CARRIER_CYCLES = 3;
const MODULATOR_CENTER = 1;
const MODULATOR_DEVIATION = 0.4;
const MODULATION_INDEX = 1.2;
const SAMPLE_COUNT = 128;

export function modulatorFrequency(elapsedMs: number): number {
  return MODULATOR_CENTER
    + MODULATOR_DEVIATION * Math.sin((elapsedMs / FM_WAVE_CYCLE_MS) * Math.PI * 2);
}

export function buildFmWavePath(elapsedMs: number): string {
  const modulator = modulatorFrequency(elapsedMs);
  const modulatorPhase = (elapsedMs / FM_WAVE_CYCLE_MS) * Math.PI * 2;
  let path = "";

  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const x = index / SAMPLE_COUNT;
    const carrierPhase = Math.PI * 2 * CARRIER_CYCLES * x;
    const modulation = MODULATION_INDEX * Math.sin(Math.PI * 2 * modulator * x + modulatorPhase);
    const y = 0.5 - 0.36 * Math.sin(carrierPhase + modulation);
    path += `${index === 0 ? "M" : " L"}${x.toFixed(4)} ${y.toFixed(4)}`;
  }

  return `${path} L1 1 L0 1 Z`;
}
