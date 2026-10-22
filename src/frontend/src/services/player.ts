import type { Song } from "../types";

export type PlaybackSource = "tracks" | "soundcloud" | "spotify";

/**
 * Whatever the site is playing, whichever way it arrived. `title` is the one
 * name the now-playing widget renders, so a source that cannot report a real
 * track name has to fall back to something honest rather than invent one.
 */
export type NowPlaying = {
  /** Render-diff key: `track:<id>`, `sc:<soundId>`, `sp:<albumId>`. */
  key: string;
  source: PlaybackSource;
  title: string;
  artist?: string;
  /** Pre-formatted by the source that knows it, so the widget never formats. */
  durationLabel?: string;
  /** Only for `tracks`: the row the audio element was pointed at. */
  song?: Song;
  /** False when the source has no transport the widget can drive. */
  controllable: boolean;
};

/** The audio element this engine owns, independent of which source is active. */
export type TrackPlayback = {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: boolean;
};

export type PlayerState = {
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  track: TrackPlayback;
  loop: boolean;
  volume: number;
};

/** What an embed reports about itself; see services/embed-players.ts. */
export type ExternalReport = {
  source: "soundcloud" | "spotify";
  key: string;
  title: string;
  artist?: string;
  durationLabel?: string;
  isPlaying: boolean;
  /** False when the platform script never loaded and the embed stays inert. */
  controllable: boolean;
};

/** The transport of the mounted embed, so `toggle` can drive it. */
export type ExternalHandle = {
  toggle: () => void;
  pause: () => void;
};

export function trackKey(song: Song): string {
  return `track:${song.id}`;
}

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
  private trackState: TrackPlayback = {
    song: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: false,
  };
  private embeds = new Map<number, ExternalHandle>();
  private activeEmbed: { token: number; report: ExternalReport } | null = null;
  private externalTokenCounter = 0;
  private playbackGeneration = 0;
  private loop = false;
  private volume = 1;
  private snapshot: PlayerState;

  constructor() {
    this.snapshot = { nowPlaying: null, isPlaying: false, track: this.trackState, loop: this.loop, volume: this.volume };
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlayerState => this.snapshot;

  getAnalyser = (): AnalyserNode | null => this.analyser;

  /**
   * One place turns the two independent sources into the single `nowPlaying`
   * every surface reads, so the title cannot drift between them.
   */
  private sync() {
    const external = this.activeEmbed?.report;
    const song = this.trackState.song;
    const nowPlaying: NowPlaying | null = external
      ? {
          key: external.key,
          source: external.source,
          title: external.title,
          artist: external.artist,
          durationLabel: external.durationLabel,
          controllable: external.controllable,
        }
      : song
        ? {
            key: trackKey(song),
            source: "tracks",
            title: song.title,
            artist: song.artist,
            durationLabel: song.duration,
            song,
            controllable: true,
          }
        : null;

    this.snapshot = {
      nowPlaying,
      isPlaying: external ? external.isPlaying : this.trackState.isPlaying && song != null,
      track: this.trackState,
      loop: this.loop,
      volume: this.volume,
    };
    this.listeners.forEach((listener) => listener());
  }

  private patchTrack(partial: Partial<TrackPlayback>) {
    this.trackState = { ...this.trackState, ...partial };
    this.sync();
  }

  private yieldToTrack() {
    const previous = this.activeEmbed;
    this.activeEmbed = null;
    if (previous) this.embeds.get(previous.token)?.pause();
  }

  private startPlayback() {
    const audio = this.ensureAudio();
    if (!audio) return;
    const generation = ++this.playbackGeneration;
    audio
      .play()
      .then(() => {
        if (generation === this.playbackGeneration) this.patchTrack({ isPlaying: true });
      })
      .catch(() => {
        if (generation === this.playbackGeneration) this.patchTrack({ isPlaying: false, error: true });
      });
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.audio) {
      const audio = new Audio();
      // Required so the media element can be routed through the Web Audio API
      // (analyser) without producing silence on cross-origin sources.
      audio.crossOrigin = "anonymous";
      audio.preload = "metadata";
      audio.loop = this.loop;
      audio.volume = this.volume;
      audio.addEventListener("timeupdate", () => {
        this.patchTrack({ currentTime: audio.currentTime || 0 });
      });
      const syncDuration = () => {
        this.patchTrack({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
      };
      audio.addEventListener("durationchange", syncDuration);
      audio.addEventListener("loadedmetadata", syncDuration);
      audio.addEventListener("play", () => this.patchTrack({ isPlaying: true, error: false }));
      audio.addEventListener("pause", () => this.patchTrack({ isPlaying: false }));
      audio.addEventListener("ended", () => this.patchTrack({ isPlaying: false, currentTime: 0 }));
      audio.addEventListener("error", () => this.patchTrack({ isPlaying: false, error: true }));
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

  reportExternal = (token: number, report: ExternalReport) => {
    if (!this.embeds.has(token)) return;
    const previous = this.activeEmbed;
    if (!report.isPlaying && previous?.token !== token) return;
    // Publish ownership before pausing: platform pause callbacks can run synchronously.
    this.activeEmbed = { token, report };
    if (report.isPlaying) {
      this.playbackGeneration++;
      if (previous && previous.token !== token) this.embeds.get(previous.token)?.pause();
      this.audio?.pause();
      this.trackState = { ...this.trackState, isPlaying: false };
    }
    this.sync();
  };

  attachExternal = (handle: ExternalHandle): number => {
    const token = ++this.externalTokenCounter;
    this.embeds.set(token, handle);
    return token;
  };

  releaseExternal = (token: number) => {
    this.embeds.delete(token);
    if (this.activeEmbed?.token !== token) return;
    this.activeEmbed = null;
    this.sync();
  };

  playSong = (song: Song) => {
    const audio = this.ensureAudio();
    if (!audio || !song.audioUrl) {
      this.patchTrack({ song, isPlaying: false, error: true });
      return;
    }
    this.yieldToTrack();
    if (audio.src !== song.audioUrl) {
      audio.src = song.audioUrl;
      audio.load();
      this.patchTrack({ song, currentTime: 0, duration: 0, error: false });
    } else {
      this.patchTrack({ song, error: false });
    }
    this.ensureCtx();
    this.startPlayback();
  };

  toggle = (song?: Song) => {
    if (!song && this.activeEmbed) {
      this.embeds.get(this.activeEmbed.token)?.toggle();
      return;
    }
    const target = song ?? this.trackState.song;
    if (!target) return;
    if (this.activeEmbed || this.trackState.song?.id !== target.id) {
      this.playSong(target);
      return;
    }
    const audio = this.ensureAudio();
    if (!audio) return;
    if (audio.paused) {
      this.ensureCtx();
      this.startPlayback();
    } else {
      this.playbackGeneration++;
      audio.pause();
    }
  };

  seek = (ratio: number) => {
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  };

  setLoop = (loop: boolean) => {
    this.loop = loop;
    if (this.audio) this.audio.loop = loop;
    this.sync();
  };

  setVolume = (volume: number) => {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) this.audio.volume = this.volume;
    this.sync();
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
