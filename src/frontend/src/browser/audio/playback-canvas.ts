import { spectrumColor } from "../../lib/audio/spectrum";

/*
 * Canvas painters for the player.
 *
 * These are pure `draw(state)` functions: no React, no refs, no DOM lookup. The
 * component owns the canvas elements and the animation loop; these own pixels.
 * Keeping them separate means the visual rules can be reasoned about (and later
 * tested) without a running player.
 */

/** One bar every N device pixels. Phones get fewer, thicker bars. */
const SPECTRUM_BAR_PITCH = 3;
const WAVE_BAR_PITCH = 3;

// Logarithmic frequency mapping so sub-bass content is visible.
const MIN_HZ = 30;
const MAX_HZ = 16000;
const MIN_LOG = Math.log10(MIN_HZ);
const MAX_LOG = Math.log10(MAX_HZ);

const PLAYED = "#c6382b";
const UNPLAYED = "#ffffff";

/**
 * Shared across every canvas that reads the analyser, since the player bar and
 * the footer square both paint from it on the same frame. Reallocated only when
 * the fftSize changes, which happens once per page.
 */
let bands: Float32Array<ArrayBuffer> | null = null;

function readBands(analyser: AnalyserNode): Float32Array<ArrayBuffer> {
  if (!bands || bands.length !== analyser.frequencyBinCount) {
    bands = new Float32Array(analyser.frequencyBinCount);
  }
  analyser.getFloatFrequencyData(bands);
  return bands;
}

/** A canvas smaller than this cannot hold a meaningful bar. */
function isDrawable(width: number, height: number): boolean {
  return width >= 2 && height >= 2;
}

function binFor(freq: number, binHz: number, maxBin: number): number {
  return Math.min(maxBin, Math.max(0, Math.round(freq / binHz)));
}

/**
 * Live frequency spectrum. Real-time analyser output, so it animates while
 * playing; with no analyser it paints a flat idle frame.
 */
export function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  analyser: AnalyserNode | null,
  isPlaying: boolean
): void {
  ctx.clearRect(0, 0, width, height);

  const data = analyser && isPlaying ? readBands(analyser) : null;

  const sampleRate = analyser ? analyser.context.sampleRate : 44100;
  const fftSize = analyser ? analyser.fftSize : 4096;
  const binHz = sampleRate / fftSize;
  const maxBin = data ? data.length - 1 : Math.floor(fftSize / 2) - 1;
  const bars = Math.max(1, Math.floor(width / SPECTRUM_BAR_PITCH));
  const barWidth = width / bars;

  for (let i = 0; i < bars; i++) {
    const freq = Math.pow(10, MIN_LOG + (i / bars) * (MAX_LOG - MIN_LOG));
    const decibels = data ? data[binFor(freq, binHz, maxBin)] : -Infinity;
    const value = data && analyser
      ? Math.floor(Math.max(0, Math.min(1,
          (decibels - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels)
        )) * 255) / 255
      : 0.12;
    ctx.fillStyle = spectrumColor(decibels);
    const barHeight = Math.max(2, value * height);
    const x = i * barWidth + barWidth * 0.12;
    ctx.fillRect(x, height - barHeight, barWidth * 0.76, barHeight);
  }
}

/**
 * Decoration, not measurement.
 *
 * A SoundCloud or Spotify embed lives in a cross-origin iframe whose samples no
 * page script can read, so there is nothing to analyse. This paints the same
 * log-frequency bar layout from a value derived from the source key, which
 * keeps the widget alive without pretending the pixels are audio. It is a
 * separate export so no call site can hand it a real AnalyserNode by mistake.
 */
export function drawPseudoSpectrum(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string,
  phase: number
): void {
  ctx.clearRect(0, 0, width, height);

  const bars = Math.max(1, Math.floor(width / SPECTRUM_BAR_PITCH));
  const barWidth = width / bars;
  // Low bars get the bass sway and the top ones the shimmer, so the square
  // keeps the silhouette of the real thing.
  const tilt = seed.length % 7;

  for (let i = 0; i < bars; i++) {
    const position = i / bars;
    const base = 0.18 + 0.5 * pseudoRandom(seed, i + tilt);
    const sway = Math.sin(phase * 0.0022 + i * 0.42 + tilt) * 0.5 + 0.5;
    const rollOff = 1 - position * 0.55;
    const value = Math.max(0.06, Math.min(1, base * (0.35 + 0.65 * sway) * rollOff));
    ctx.fillStyle = spectrumColor(-100 + value * 70);
    const barHeight = Math.max(2, value * height);
    const x = i * barWidth + barWidth * 0.12;
    ctx.fillRect(x, height - barHeight, barWidth * 0.76, barHeight);
  }
}

/** Stable per-bar value from the seed, so the animation does not reshuffle. */
function pseudoRandom(seed: string, index: number): number {
  let hash = 2166136261;
  const text = `${seed}:${index}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/**
 * Static song waveform, which doubles as the seek slider and the progress fill:
 * the played portion is painted red, the rest white.
 */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  peaks: Float32Array | null,
  progress: number
): void {
  ctx.clearRect(0, 0, width, height);

  const bars = Math.max(1, Math.floor(width / WAVE_BAR_PITCH));
  const barWidth = width / bars;
  const mid = height / 2;
  const played = progress * bars;

  for (let i = 0; i < bars; i++) {
    let value = 0.2;
    if (peaks && peaks.length) {
      const index = Math.min(peaks.length - 1, Math.floor((i / bars) * peaks.length));
      value = peaks[index];
    }
    const barHeight = Math.max(2, value * height * 0.92);
    const x = i * barWidth + barWidth * 0.18;
    const w = Math.max(1, barWidth * 0.64);
    ctx.fillStyle = i < played ? PLAYED : UNPLAYED;
    ctx.fillRect(x, mid - barHeight / 2, w, barHeight);
  }
}

/**
 * Resizes a canvas backing store to match its rendered size and pixel ratio.
 * Returns false when there is nothing to paint yet, so callers can skip a
 * frame instead of drawing into a 0x0 buffer.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  if (!isDrawable(width, height)) return false;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return true;
}
