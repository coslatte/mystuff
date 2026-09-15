import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeWaveform, player, type WaveformPeaks } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";

// Matches the `laptop` breakpoint in global.css: the bar is only rendered
// from this width up, so decoding the waveform on phones is wasted work.
const LAPTOP_QUERY = "(min-width: 64rem)";

// The canvas is painted at a fixed backing resolution and scaled down by CSS,
// so the bars stay crisp on retina screens. One bar every 3 backing pixels
// gives a dense, SoundCloud-like waveform without hurting paint cost.
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 96;
const BAR_PITCH = 3;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [visible, setVisible] = useState(false);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(LAPTOP_QUERY);
    const update = () => setVisible(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!visible || !song?.audioUrl) {
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
  }, [visible, song?.id, song?.audioUrl]);

  const fallback = useMemo(() => (song ? syntheticPeaks(song.id) : null), [song?.id]);
  const peaks = decoded ?? fallback;

  // Static song waveform: doubles as the seek slider and the progress fill.
  // The played portion is painted red, the rest white, like SoundCloud.
  const drawWaveform = useCallback(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const width = canvas.width;
    const height = canvas.height;
    cctx.clearRect(0, 0, width, height);

    const bars = Math.max(1, Math.floor(width / BAR_PITCH));
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
      const bh = Math.max(3, value * height * 0.92);
      const x = i * barW + barW * 0.18;
      const w = Math.max(1, barW * 0.64);
      cctx.fillStyle = i < played ? "#ff3300" : "#ffffff";
      cctx.fillRect(x, mid - bh / 2, w, bh);
    }
  }, [peaks, currentTime, duration]);

  useEffect(() => {
    if (visible) drawWaveform();
  }, [visible, drawWaveform]);

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
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [seekFromPointer]);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => player.toggle()}
          disabled={!song}
          className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black text-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
          className="relative h-12 flex-1 cursor-pointer touch-none border-2 border-black bg-black p-1"
        >
          <canvas
            ref={waveformRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block h-full w-full"
          />
        </div>

        <div className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs font-bold text-black">
          {formatTime(currentTime)}
        </div>
      </div>

      {error && (
        <p className="font-mono text-[10px] font-bold text-brut-red">
          playback error — could not stream this track.
        </p>
      )}
    </div>
  );
}
