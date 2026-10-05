import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { computeWaveform, player, type WaveformPeaks } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";
import { drawSpectrum, drawWaveform, sizeCanvas } from "../lib/playback-canvas";
import { playPauseClass, playPauseGlyph } from "../lib/playback-ui";

const SEEK_STEP_SECONDS = 5;

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
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * Stand-in envelope drawn while the decode is in flight and when it fails
 * outright (a signed URL served without CORS). Deterministic, so the bars do not
 * reshuffle on every render.
 */
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

  const paintSpectrum = useCallback(() => {
    const canvas = spectrumRef.current;
    if (!canvas || !sizeCanvas(canvas, spectrumSize.width, spectrumSize.height)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawSpectrum(ctx, canvas.width, canvas.height, player.getAnalyser(), isPlaying);
  }, [isPlaying, spectrumSize.width, spectrumSize.height]);

  useEffect(() => {
    paintSpectrum();
    if (!isPlaying) return;
    const animate = () => {
      paintSpectrum();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, paintSpectrum]);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const paintWaveform = useCallback(() => {
    const canvas = waveformRef.current;
    if (!canvas || !sizeCanvas(canvas, waveSize.width, waveSize.height)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWaveform(ctx, canvas.width, canvas.height, peaks, progress);
  }, [peaks, progress, waveSize.width, waveSize.height]);

  useEffect(() => {
    paintWaveform();
  }, [paintWaveform]);

  const seekFromPointer = useCallback((clientX: number) => {
    const bar = seekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    player.seek(ratio);
  }, []);

  const seekToSeconds = useCallback(
    (seconds: number) => {
      if (duration <= 0) return;
      player.seek(Math.max(0, Math.min(1, seconds / duration)));
    },
    [duration]
  );

  const onSeekKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowLeft":
          seekToSeconds(currentTime - SEEK_STEP_SECONDS);
          break;
        case "ArrowRight":
          seekToSeconds(currentTime + SEEK_STEP_SECONDS);
          break;
        case "Home":
          seekToSeconds(0);
          break;
        case "End":
          seekToSeconds(duration);
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    [currentTime, duration, seekToSeconds]
  );

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
          className={playPauseClass(
            isPlaying,
            "flex h-11 w-11 shrink-0 items-center justify-center border-2 border-black text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 laptop:h-12 laptop:w-12 laptop:text-xl"
          )}
          aria-label={isPlaying ? "pause" : "play"}
        >
          <span key={isPlaying ? "pause" : "play"} className="icon-morph">
            {playPauseGlyph(isPlaying)}
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
        onKeyDown={onSeekKeyDown}
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