import { mountVolumeControl } from "../../browser/audio/volume-control";
import { messages } from "../../lib/i18n/catalog";
import { useTranslations } from "../../hooks/useTranslations";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { computeWaveform, player, type WaveformPeaks } from "../../services/player";
import { usePlayer } from "../../hooks/usePlayer";
import { drawSpectrum, drawWaveform, sizeCanvas } from "../../browser/audio/playback-canvas";
import { formatClock, playPauseClass, playPauseGlyph } from "../../lib/audio/playback-ui";
import type { Song } from "../../types";

const SEEK_STEP_SECONDS = 5;

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

export default function PlayerBar({ song, preloadWaveform = true }: { song: Song; preloadWaveform?: boolean }) {
  const t = useTranslations();
  // Browsing another preview must not expose the playing song's seek position.
  const { track, loop } = usePlayer();
  const volumeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (volumeRef.current) return mountVolumeControl(volumeRef.current);
  }, []);
  const active = track.song?.id === song.id && track.song?.audioUrl === song.audioUrl;
  const isPlaying = active && track.isPlaying;
  const currentTime = active ? track.currentTime : 0;
  const duration = active ? track.duration : 0;
  const error = active && track.error;
  const [decoded, setDecoded] = useState<WaveformPeaks | null>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  const spectrumSize = useCanvasSize(spectrumRef);
  const waveSize = useCanvasSize(waveformRef);

  useEffect(() => {
    if (!song?.audioUrl || !preloadWaveform) {
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
  }, [song?.id, song?.audioUrl, preloadWaveform]);

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
    if (!active) return;
    const bar = seekBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    player.seek(ratio);
  }, [active]);

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
      <div className="player-console">
        <button
          type="button"
          onClick={() => player.toggle(song ?? undefined)}
          disabled={!song}
          className={playPauseClass(
            isPlaying,
            "player-transport"
          )}
          aria-label={t.text(isPlaying ? "pause" : "play")}
        >
          <span key={isPlaying ? "pause" : "play"} className="icon-morph">
            {t.text(playPauseGlyph(isPlaying))}
          </span>
        </button>

        <button type="button" className="player-transport player-repeat" aria-pressed={loop}
          aria-label={t(messages.music.loop)} title={t(messages.music.loop)}
          onClick={() => player.setLoop(!loop)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3" />
          </svg>
        </button>

        <div className="min-w-0 flex-1 border-2 border-brut-black bg-brut-inverse p-1" aria-hidden="true">
          <canvas ref={spectrumRef} className="block h-8 w-full" />
        </div>

        <div className="flex h-11 shrink-0 items-center border-2 border-brut-black bg-brut-surface px-2 font-mono text-[10px] font-bold text-brut-black laptop:text-xs">
          {t.text(formatClock(currentTime))}
        </div>
        <div ref={volumeRef} className="volume-wake" />
      </div>

      <div
        ref={seekBarRef}
        role="slider"
        aria-label={t(messages.music.seek)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime)}
        aria-disabled={!active || duration <= 0}
        tabIndex={0}
        onKeyDown={onSeekKeyDown}
        onPointerDown={(e) => {
          scrubbingRef.current = true;
          seekFromPointer(e.clientX);
        }}
        className="relative h-10 cursor-pointer touch-none border-2 border-brut-black bg-brut-inverse p-1"
      >
        <canvas ref={waveformRef} className="block h-full w-full" />
      </div>

      {error && (
        <p className="font-mono text-[10px] font-bold text-brut-danger">{t(messages.music.playbackError)}</p>
      )}
    </div>
  );
}
