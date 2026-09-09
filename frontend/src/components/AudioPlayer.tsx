import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Song } from "../types";

export type AudioPlayerHandle = {
  playSong: (song: Song) => void;
  toggle: () => void;
  stop: () => void;
};

type Props = {
  song: Song | null;
  onPlayingChange: (isPlaying: boolean) => void;
};

const BARS = 44;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(function AudioPlayer(
  { song, onPlayingChange },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const songRef = useRef<Song | null>(song);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  songRef.current = song;

  const drawBars = useCallback((peaks?: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const width = canvas.width;
    const height = canvas.height;
    cctx.clearRect(0, 0, width, height);
    const bw = width / BARS;
    for (let i = 0; i < BARS; i++) {
      const v = peaks ? peaks[Math.floor((i * peaks.length) / Math.max(BARS, 1))] / 255 : 0.12;
      const bh = Math.max(3, v * height);
      const x = i * bw + bw * 0.12;
      cctx.fillStyle = i % 2 === 0 ? "#ff3300" : "#ffd600";
      cctx.fillRect(x, height - bh, bw * 0.76, bh);
    }
  }, []);

  const drawIdle = useCallback(() => drawBars(), [drawBars]);

  const startDraw = useCallback(() => {
    const animate = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        drawBars(data);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [drawBars]);

  const stopDraw = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const ensureCtx = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || typeof window === "undefined") return;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try {
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        ctxRef.current = null;
      }
    }
    if (ctxRef.current && ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
  }, []);

  const syncSource = useCallback((target: Song) => {
    const audio = audioRef.current;
    if (!audio || !target.audioUrl) return;
    if (audio.src !== target.audioUrl) {
      audio.src = target.audioUrl;
      audio.load();
      setCurrentTime(0);
      setDuration(0);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = audio.src ? songRef.current : song;
    if (!audio.src && target) {
      syncSource(target);
    }
    ensureCtx();
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          startDraw();
          onPlayingChange(true);
        })
        .catch(() => onPlayingChange(false));
    } else {
      audio.pause();
      stopDraw();
      onPlayingChange(false);
    }
  }, [ensureCtx, onPlayingChange, song, startDraw, stopDraw, syncSource]);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    stopDraw();
    drawIdle();
    onPlayingChange(false);
  }, [drawIdle, onPlayingChange, stopDraw]);

  useImperativeHandle(ref, () => ({
    playSong: (target) => {
      const audio = audioRef.current;
      if (!audio || !target.audioUrl) return;
      syncSource(target);
      ensureCtx();
      setCurrentTime(0);
      audio
        .play()
        .then(() => {
          setCurrentTime(audio.currentTime);
          startDraw();
          onPlayingChange(true);
        })
        .catch(() => {
          stopDraw();
          onPlayingChange(false);
        });
    },
    toggle: togglePlay,
    stop: stopPlayback,
  }));

  useEffect(() => {
    if (song && songRef.current !== song) {
      songRef.current = song;
    }
    if (song && song.audioUrl) {
      syncSource(song);
      drawIdle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, song?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setCurrentTime(audio.currentTime);
      startDraw();
      onPlayingChange(true);
    };
    const onPause = () => {
      stopDraw();
      onPlayingChange(false);
    };
    const onEnded = () => {
      setCurrentTime(0);
      stopDraw();
      drawIdle();
      onPlayingChange(false);
    };
    const onError = () => {
      stopDraw();
      onPlayingChange(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    drawIdle();
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [drawIdle, onPlayingChange, startDraw, stopDraw]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black bg-brut-yellow text-xl font-bold text-black transition-colors hover:bg-brut-red hover:text-white"
          aria-label="play / pause"
        >
          {song?.audioUrl ? "▶" : "×"}
        </button>
        <div className="flex-1 border-2 border-black bg-black p-1">
          <canvas ref={canvasRef} width={512} height={88} className="h-16 w-full md:h-20" />
        </div>
        <div className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs font-bold text-black">
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "—"}
        </div>
      </div>
      <div className="h-2 w-full border-2 border-black bg-white">
        <div className="h-full bg-brut-red transition-none" style={{ width: `${progress}%` }} />
      </div>
      <audio ref={audioRef} preload="metadata" className="hidden" />
    </div>
  );
});

export default AudioPlayer;
