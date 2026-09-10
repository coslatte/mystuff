import { useCallback, useEffect, useRef } from "react";
import { player } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";

const BARS = 44;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerBar() {
  const { song, isPlaying, currentTime, duration, error } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const width = canvas.width;
    const height = canvas.height;
    cctx.clearRect(0, 0, width, height);
    const analyser = player.getAnalyser();
    let peaks: Uint8Array<ArrayBuffer> | null = null;
    if (analyser && isPlaying) {
      peaks = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      analyser.getByteFrequencyData(peaks);
    }
    const bw = width / BARS;
    for (let i = 0; i < BARS; i++) {
      const v = peaks ? peaks[Math.floor((i * peaks.length) / Math.max(BARS, 1))] / 255 : 0.12;
      const bh = Math.max(3, v * height);
      const x = i * bw + bw * 0.12;
      cctx.fillStyle = i % 2 === 0 ? "#ff3300" : "#ffd600";
      cctx.fillRect(x, height - bh, bw * 0.76, bh);
    }
  }, [isPlaying]);

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

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => player.toggle()}
          disabled={!song}
          className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black bg-brut-yellow text-xl font-bold text-black transition-colors hover:bg-brut-red hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={isPlaying ? "pause" : "play"}
        >
          {isPlaying ? "‖" : "▶"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            player.seek((e.clientX - rect.left) / rect.width);
          }}
          className="flex-1 border-2 border-black bg-black p-1"
          aria-label="seek"
        >
          <canvas ref={canvasRef} width={512} height={88} className="h-16 w-full md:h-20" />
        </button>
        <div className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs font-bold text-black">
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "—"}
        </div>
      </div>
      <div className="h-2 w-full border-2 border-black bg-white">
        <div className="h-full bg-brut-red transition-none" style={{ width: `${progress}%` }} />
      </div>
      {error && (
        <p className="font-mono text-[10px] font-bold text-brut-red">
          playback error — could not stream this track.
        </p>
      )}
    </div>
  );
}
