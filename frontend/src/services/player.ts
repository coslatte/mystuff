import type { Song } from "../types";

export type PlayerState = {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: boolean;
};

type Listener = () => void;

// Safari still ships the prefixed constructor.
function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

class PlayerEngine {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private listeners = new Set<Listener>();
  private snapshot: PlayerState = {
    song: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: false,
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlayerState => this.snapshot;

  getAnalyser = (): AnalyserNode | null => this.analyser;

  private patch(partial: Partial<PlayerState>) {
    this.snapshot = { ...this.snapshot, ...partial };
    this.listeners.forEach((listener) => listener());
  }

  private startPlayback() {
    const audio = this.ensureAudio();
    if (!audio) return;
    audio
      .play()
      .then(() => this.patch({ isPlaying: true }))
      .catch(() => this.patch({ isPlaying: false, error: true }));
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.audio) {
      const audio = new Audio();
      // Required so the media element can be routed through the Web Audio API
      // (analyser) without producing silence on cross-origin sources.
      audio.crossOrigin = "anonymous";
      audio.preload = "metadata";
      audio.addEventListener("timeupdate", () => {
        this.patch({ currentTime: audio.currentTime || 0 });
      });
      const syncDuration = () => {
        this.patch({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
      };
      audio.addEventListener("durationchange", syncDuration);
      audio.addEventListener("loadedmetadata", syncDuration);
      audio.addEventListener("play", () => this.patch({ isPlaying: true, error: false }));
      audio.addEventListener("pause", () => this.patch({ isPlaying: false }));
      audio.addEventListener("ended", () => this.patch({ isPlaying: false, currentTime: 0 }));
      audio.addEventListener("error", () => this.patch({ isPlaying: false, error: true }));
      this.audio = audio;
    }
    return this.audio;
  }

  private ensureCtx() {
    const audio = this.audio;
    if (!audio || typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = audioContextCtor();
      if (!Ctx) return;
      try {
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        this.ctx = ctx;
        this.analyser = analyser;
      } catch {
        this.ctx = null;
        this.analyser = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  playSong = (song: Song) => {
    const audio = this.ensureAudio();
    if (!audio || !song.audioUrl) {
      this.patch({ song, isPlaying: false, error: true });
      return;
    }
    if (audio.src !== song.audioUrl) {
      audio.src = song.audioUrl;
      audio.load();
      this.patch({ song, currentTime: 0, duration: 0, error: false });
    } else {
      this.patch({ song, error: false });
    }
    this.ensureCtx();
    this.startPlayback();
  };

  toggle = (song?: Song) => {
    const audio = this.ensureAudio();
    if (!audio) return;
    const target = song ?? this.snapshot.song;
    if (!this.snapshot.song && target) {
      this.playSong(target);
      return;
    }
    if (audio.paused) {
      if (target && this.snapshot.song?.id !== target.id) {
        this.playSong(target);
        return;
      }
      this.ensureCtx();
      this.startPlayback();
    } else {
      audio.pause();
    }
  };

  seek = (ratio: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  };
}

export const player = new PlayerEngine();

export type WaveformPeaks = Float32Array;

// Peaks are normalized to 0..1 and resampled to whatever bar count the canvas
// needs at draw time, so one decode serves every bar pitch and window width.
const WAVEFORM_RESOLUTION = 2048;
// Keyed by audio URL, not song id: replacing a track's audio reuses the same row
// id but points at different bytes, and the old envelope would stick forever.
const waveformCache = new Map<string, WaveformPeaks>();
const WAVEFORM_CACHE_MAX = 32;

function cacheWaveform(url: string, peaks: WaveformPeaks) {
  if (waveformCache.size >= WAVEFORM_CACHE_MAX) {
    const oldest = waveformCache.keys().next().value;
    if (oldest !== undefined) waveformCache.delete(oldest);
  }
  waveformCache.set(url, peaks);
}

export async function computeWaveform(song: Song): Promise<WaveformPeaks | null> {
  if (typeof window === "undefined" || !song.audioUrl) return null;
  const url = song.audioUrl;
  const cached = waveformCache.get(url);
  if (cached) return cached;

  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const encoded = await response.arrayBuffer();

    const Ctor = audioContextCtor();
    if (!Ctor) return null;

    const ctx = new Ctor();
    try {
      const buffer = await ctx.decodeAudioData(encoded);
      const channel = buffer.getChannelData(0);
      const peaks = new Float32Array(WAVEFORM_RESOLUTION);
      const block = Math.max(1, Math.floor(channel.length / WAVEFORM_RESOLUTION));
      let max = 0;
      for (let i = 0; i < WAVEFORM_RESOLUTION; i++) {
        const start = i * block;
        const end = Math.min(channel.length, start + block);
        let peak = 0;
        for (let j = start; j < end; j++) {
          const sample = channel[j] < 0 ? -channel[j] : channel[j];
          if (sample > peak) peak = sample;
        }
        peaks[i] = peak;
        if (peak > max) max = peak;
      }
      if (max > 0) {
        for (let i = 0; i < peaks.length; i++) peaks[i] /= max;
      }
      cacheWaveform(url, peaks);
      return peaks;
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}