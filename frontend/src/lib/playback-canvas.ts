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

const PLAYED = "#ff3300";
const UNPLAYED = "#ffffff";

/** A canvas smaller than this cannot hold a meaningful bar. */
function isDrawable(width: number, height: number): boolean {
  return width >= 2 && height >= 2;
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

  let bands: Uint8Array<ArrayBuffer> | null = null;
  if (analyser && isPlaying) {
    bands = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    analyser.getByteFrequencyData(bands);
  }

  const sampleRate = analyser ? analyser.context.sampleRate : 44100;
  const fftSize = analyser ? analyser.fftSize : 4096;
  const binHz = sampleRate / fftSize;
  const maxBin = bands ? bands.length - 1 : Math.floor(fftSize / 2) - 1;
  const bars = Math.max(1, Math.floor(width / SPECTRUM_BAR_PITCH));
  const barWidth = width / bars;

  ctx.fillStyle = UNPLAYED;
  for (let i = 0; i < bars; i++) {
    const freq = Math.pow(10, MIN_LOG + (i / bars) * (MAX_LOG - MIN_LOG));
    const bin = Math.min(maxBin, Math.max(0, Math.round(freq / binHz)));
    const value = bands ? bands[bin] / 255 : 0.12;
    const barHeight = Math.max(2, value * height);
    const x = i * barWidth + barWidth * 0.12;
    ctx.fillRect(x, height - barHeight, barWidth * 0.76, barHeight);
  }
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
