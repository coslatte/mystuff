import { useCallback, useEffect, useRef } from "react";
import { player } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";

const BARS = 800;
const MIN_HZ = 30;
const MAX_HZ = 16000;

const MIN_LOG = Math.log10(MIN_HZ);
const MAX_LOG = Math.log10(MAX_HZ);

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerBar() {
  const { song, isPlaying, currentTime, duration, buffered, error } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

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
    const sampleRate = analyser ? analyser.context.sampleRate : 44100;
    const fftSize = analyser ? analyser.fftSize : 4096;
    const binHz = sampleRate / fftSize;
    const maxBin = peaks ? peaks.length - 1 : Math.floor(fftSize / 2) - 1;
    const bw = width / BARS;
    for (let i = 0; i < BARS; i++) {
      // Logarithmic frequency mapping so sub-bass / subwoofer content is visible.
      const freq = Math.pow(10, MIN_LOG + (i / BARS) * (MAX_LOG - MIN_LOG));
      const bin = Math.min(maxBin, Math.max(0, Math.round(freq / binHz)));
      const v = peaks ? peaks[bin] / 255 : 0.12;
      const bh = Math.max(3, v * height);
      const x = i * bw + bw * 0.12;
      cctx.fillStyle = "#ffffff";
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

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

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
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            player.seek((e.clientX - rect.left) / rect.width);
          }}
          className="flex-1 border-2 border-black bg-black p-1"
          aria-label="seek"
        >
          <canvas ref={canvasRef} width={1600} height={88} className="h-16 w-full md:h-20" />
        </button>
        <div className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs font-bold text-black">
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
        className="relative h-2 w-full cursor-pointer touch-none border-2 border-black bg-white"
      >
        <div className="absolute inset-y-0 left-0 bg-neutral-400" style={{ width: `${bufferedPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-brut-red transition-none" style={{ width: `${progress}%` }} />
      </div>
      {error && (
        <p className="font-mono text-[10px] font-bold text-brut-red">
          playback error — could not stream this track.
        </p>
      )}
    </div>
  );
}
