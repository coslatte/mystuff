import type { Song } from "../types";

export type PlayerState = {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  error: boolean;
};

type Listener = () => void;

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
    buffered: 0,
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
      audio.addEventListener("durationchange", () => {
        this.patch({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
      });
      audio.addEventListener("loadedmetadata", () => {
        this.patch({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
      });
      audio.addEventListener("play", () => this.patch({ isPlaying: true, error: false }));
      audio.addEventListener("pause", () => this.patch({ isPlaying: false }));
      audio.addEventListener("ended", () => this.patch({ isPlaying: false, currentTime: 0 }));
      audio.addEventListener("error", () => this.patch({ isPlaying: false, error: true }));
      audio.addEventListener("progress", () => {
        const dur = audio.duration;
        if (Number.isFinite(dur) && dur > 0 && audio.buffered.length > 0) {
          // Track how much of the track has downloaded so the UI can preview it.
          const end = audio.buffered.end(audio.buffered.length - 1);
          this.patch({ buffered: end });
        }
      });
      this.audio = audio;
    }
    return this.audio;
  }

  private ensureCtx() {
    const audio = this.audio;
    if (!audio || typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    const sameSource = audio.src === song.audioUrl;
    if (!sameSource) {
      audio.src = song.audioUrl;
      audio.load();
      this.patch({ song, currentTime: 0, duration: 0, buffered: 0, error: false });
    } else {
      this.patch({ song, error: false });
    }
    this.ensureCtx();
    audio
      .play()
      .then(() => this.patch({ isPlaying: true }))
      .catch(() => this.patch({ isPlaying: false, error: true }));
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
      audio
        .play()
        .then(() => this.patch({ isPlaying: true }))
        .catch(() => this.patch({ isPlaying: false, error: true }));
    } else {
      audio.pause();
    }
  };

  stop = () => {
    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    this.patch({ isPlaying: false, currentTime: 0 });
  };

  seek = (ratio: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  };
}

export const player = new PlayerEngine();
