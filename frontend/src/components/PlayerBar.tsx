import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { computeWaveform, player, type WaveformPeaks } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";

// Logarithmic frequency mapping so sub-bass content is visible.
const MIN_HZ = 30;
const MAX_HZ = 16000;
const MIN_LOG = Math.log10(MIN_HZ);
const MAX_LOG = Math.log10(MAX_HZ);

// One bar every N device pixels. Because the backing store tracks the real
// rendered width (see useCanvasSize), phones get fewer, thicker bars instead
// of hundreds of sub-pixel ones.
const SPECTRUM_BAR_PITCH = 3;
const WAVE_BAR_PITCH = 3;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Keeps a canvas backing store in sync with its rendered size and pixel ratio.
function useCanvasSize(ref: RefObject<HTMLCanvasElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return size;
}

// Deterministic envelope used when a track cannot be decoded (e.g. a signed
// URL without CORS). It still reads as a waveform instead of the flat line the
// player would otherwise draw, and it never changes between renders.
function syntheticPeaks(seed: number): WaveformPeaks {
  const count = 256;
  const peaks = new Float32Array(count);
  let state = (seed * 2654435761) % 2147483647;
  if (state <= 0) state += 2147483646;
  const rand = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  let level = 0.55;
  for (let i = 0; i < count; i++) {
    level = Math.max(0.08, Math.min(1, level + (rand() - 0.48) * 0.4));
    peaks[i] = level * (0.6 + rand() * 0.4);
  }
  return peaks;
}

export default function PlayerBar() {
  const { song, isPlaying, currentTime, duration, error } = usePlayer();
  const [decoded, setDecoded] = useState<WaveformPeaks | null>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  const spectrumSize = useCanvasSize(spectrumRef);
  const waveSize = useCanvasSize(waveformRef);

  useEffect(() => {
    if (!song?.audioUrl) {
      setDecoded(null);
      return;
    }
    let cancelled = false;
    computeWaveform(song).then((result) => {
      if (!cancelled) setDecoded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [song?.id, song?.audioUrl]);

  const fallback = useMemo(() => (song ? syntheticPeaks(song.id) : null), [song?.id]);
  const peaks = decoded ?? fallback;

  // Live frequency spectrum. Real-time analyser output, so it animates while
  // playing and paints a single idle frame otherwise.
  const drawSpectrum = useCallback(() => {
    const canvas = spectrumRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const width = canvas.width;
    const height = canvas.height;
    if (width < 2 || height < 2) return;
    cctx.clearRect(0, 0, width, height);

    const analyser = player.getAnalyser();
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
    const bw = width / bars;

    for (let i = 0; i < bars; i++) {
      const freq = Math.pow(10, MIN_LOG + (i / bars) * (MAX_LOG - MIN_LOG));
      const bin = Math.min(maxBin, Math.max(0, Math.round(freq / binHz)));
      const value = bands ? bands[bin] / 255 : 0.12;
      const bh = Math.max(2, value * height);
      const x = i * bw + bw * 0.12;
      cctx.fillStyle = "#ffffff";
      cctx.fillRect(x, height - bh, bw * 0.76, bh);
    }
  }, [isPlaying]);

  useEffect(() => {
    const canvas = spectrumRef.current;
    if (!canvas || spectrumSize.width < 2) return;
    if (canvas.width !== spectrumSize.width) canvas.width = spectrumSize.width;
    if (canvas.height !== spectrumSize.height) canvas.height = spectrumSize.height;
    drawSpectrum();
  }, [spectrumSize.width, spectrumSize.height, drawSpectrum]);

  useEffect(() => {
    drawSpectrum();
    if (!isPlaying) return;
    const animate = () => {
      drawSpectrum();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, drawSpectrum]);

  // Static song waveform: doubles as the seek slider and the progress fill.
  // The played portion is painted red, the rest white, like SoundCloud.
  const drawWaveform = useCallback(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const width = canvas.width;
    const height = canvas.height;
    if (width < 2 || height < 2) return;
    cctx.clearRect(0, 0, width, height);

    const bars = Math.max(1, Math.floor(width / WAVE_BAR_PITCH));
    const barW = width / bars;
    const mid = height / 2;
    const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const played = progress * bars;

    for (let i = 0; i < bars; i++) {
      let value = 0.2;
      if (peaks && peaks.length) {
        const idx = Math.min(peaks.length - 1, Math.floor((i / bars) * peaks.length));
        value = peaks[idx];
      }
      const bh = Math.max(2, value * height * 0.92);
      const x = i * barW + barW * 0.18;
      const w = Math.max(1, barW * 0.64);
      cctx.fillStyle = i < played ? "#ff3300" : "#ffffff";
      cctx.fillRect(x, mid - bh / 2, w, bh);
    }
  }, [peaks, currentTime, duration]);

  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas || waveSize.width < 2) return;
    if (canvas.width !== waveSize.width) canvas.width = waveSize.width;
    if (canvas.height !== waveSize.height) canvas.height = waveSize.height;
    drawWaveform();
  }, [waveSize.width, waveSize.height, drawWaveform]);

  const seekFromPointer = useCallback((clientX: number) => {
    const bar = seekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    player.seek(ratio);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (scrubbingRef.current) seekFromPointer(e.clientX);
    };
    const onUp = () => {
      scrubbingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [seekFromPointer]);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2 laptop:gap-3">
        <button
          type="button"
          onClick={() => player.toggle()}
          disabled={!song}
          className={`flex h-11 w-11 shrink-0 items-center justify-center border-2 border-black text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 laptop:h-12 laptop:w-12 laptop:text-xl ${
            isPlaying
              ? "bg-brut-red text-white hover:bg-black hover:text-white"
              : "bg-brut-yellow text-black hover:bg-black hover:text-white"
          }`}
          aria-label={isPlaying ? "pause" : "play"}
        >
          <span key={isPlaying ? "pause" : "play"} className="icon-morph">
            {isPlaying ? "𐋃" : "▶"}
          </span>
        </button>

        <div className="min-w-0 flex-1 border-2 border-black bg-black p-1" aria-hidden="true">
          <canvas ref={spectrumRef} className="block h-10 w-full laptop:h-12" />
        </div>

        <div className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-[10px] font-bold text-black laptop:text-xs">
          {formatTime(currentTime)}
        </div>
      </div>

      <div
        ref={seekBarRef}
        role="slider"
        aria-label="seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onPointerDown={(e) => {
          scrubbingRef.current = true;
          seekFromPointer(e.clientX);
        }}
        className="relative h-10 cursor-pointer touch-none border-2 border-black bg-black p-1"
      >
        <canvas ref={waveformRef} className="block h-full w-full" />
      </div>

      {error && (
        <p className="font-mono text-[10px] font-bold text-brut-red">
          playback error: could not stream this track. check your internet connectivity.
        </p>
      )}
    </div>
  );
}
