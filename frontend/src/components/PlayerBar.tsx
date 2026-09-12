import { useCallback, useEffect, useRef, useState } from "react";
import { computeWaveform, player, type WaveformPeaks } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerBar() {
  const { song, isPlaying, currentTime, duration, error } = usePlayer();
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const progressRef = useRef(0);

  progressRef.current = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  useEffect(() => {
    if (!song?.audioUrl) {
      setPeaks(null);
      return;
    }
    let cancelled = false;
    computeWaveform(song).then((result) => {
      if (!cancelled) setPeaks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [song?.id, song?.audioUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const width = canvas.width;
    const height = canvas.height;
    cctx.clearRect(0, 0, width, height);

    // One bar every 3 device pixels: dense enough to read as a waveform,
    // light enough to stay fluid on every frame.
    const bars = Math.max(1, Math.floor(width / 3));
    const barW = width / bars;
    const mid = height / 2;
    const played = progressRef.current * bars;

    for (let i = 0; i < bars; i++) {
      let value = 0.14;
      if (peaks && peaks.length) {
        const idx = Math.min(peaks.length - 1, Math.floor((i / bars) * peaks.length));
        value = peaks[idx];
      }
      const bh = Math.max(2, value * height * 0.94);
      const x = i * barW + barW * 0.15;
      const w = Math.max(1, barW * 0.7);
      cctx.fillStyle = i < played ? "#ff3300" : "#ffffff";
      cctx.fillRect(x, mid - bh / 2, w, bh);
    }
  }, [peaks]);

  useEffect(() => {
    const animate = () => {
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [draw]);

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
    <div className="flex w-full flex-col gap-3">
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
          <span key={isPlaying} className="icon-morph">
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
          className="relative flex-1 cursor-pointer touch-none border-2 border-black bg-black p-0.5"
        >
          <canvas ref={canvasRef} width={1600} height={96} className="block h-10 w-full laptop:h-12" />
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
