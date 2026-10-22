import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { messages } from "../../lib/i18n/catalog";
import { useTranslations } from "../../hooks/useTranslations";
import type { Song, StreamingPlatform } from "../../types";
import { api } from "../../services/api";
import { player } from "../../services/player";
import {
  hasLinks,
  STREAMING_PLATFORMS,
  type PlayableAlbum,
} from "../../data/streaming-albums";
import { useAlbums } from "../../hooks/useAlbums";
import { useServerWarmup } from "../../hooks/useServerWarmup";
import { useSongs } from "../../hooks/useSongs";
import PlayerBar from "./PlayerBar";
import TrackBlock from "./TrackBlock";
import TrackShareControls from "./TrackShareControls";
import { readText } from "../../services/storage";
import AlbumCard from "./AlbumCard";
import ErrorNotice from "../shared/ErrorNotice";
import LoadingTracks from "../loading/LoadingTracks";

const uploadDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

type CatalogEntry =
  | { kind: "album"; key: string; album: PlayableAlbum }
  | { kind: "track"; key: string; song: Song };

const platformNames: Record<StreamingPlatform, string> = {
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  "youtube-music": "YouTube Music",
  "apple-music": "Apple Music",
};

type ReportStatus = "sending" | "sent" | "failed";

type BoundaryProps = {
  children: ReactNode;
  onError: (error: Error, componentStack?: string) => void;
  fallback: (retry: () => void) => ReactNode;
};

type BoundaryState = { error: Error | null };

class MusicErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info.componentStack ?? "");
  }

  capture = (error: Error) => {
    if (this.state.error) return;
    this.setState({ error });
    this.props.onError(error);
  };

  retry = () => {
    try {
      player.recover();
    } finally {
      this.setState({ error: null });
    }
  };

  render() {
    return this.state.error ? this.props.fallback(this.retry) : this.props.children;
  }
}

function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : "Unhandled client exception.");
}

function safeStack(stack: string): string {
  return stack.replace(/(https?:\/\/[^\s)]+)[?#][^\s)]*/g, "$1").slice(0, 2500);
}

export default function MusicSection() {
  const t = useTranslations();
  const boundary = useRef<MusicErrorBoundary | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const lastReport = useRef<{ signature: string; at: number } | null>(null);

  const reportError = useCallback((error: Error, componentStack = "") => {
    const stack = safeStack([error.stack ?? "", componentStack].filter(Boolean).join("\n"));
    const message = safeStack(error.message).slice(0, 1000) || "Unknown client error.";
    const signature = `${error.name}:${message}:${stack}`;
    const now = Date.now();
    if (lastReport.current?.signature === signature && now - lastReport.current.at < 2000) return;
    lastReport.current = { signature, at: now };
    setReportStatus("sending");
    void api.reportClientError({
      component: "MusicSection",
      errorName: error.name.slice(0, 100) || "Error",
      message,
      stack,
      path: window.location.pathname.slice(0, 300),
    }).then(() => setReportStatus("sent"), () => setReportStatus("failed"));
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (event.message) boundary.current?.capture(asError(event.error ?? event.message));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      boundary.current?.capture(asError(event.reason));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const statusMessage = reportStatus == null
    ? ""
    : t(reportStatus === "sending"
      ? messages.music.componentErrorSending
      : reportStatus === "sent"
        ? messages.music.componentErrorSent
        : messages.music.componentErrorReportFailed);

  return (
    <MusicErrorBoundary
      ref={boundary}
      onError={reportError}
      fallback={(retry) => (
        <div className="music-browser border-2 border-brut-black bg-brut-surface p-6" role="alert">
          <h3 className="text-lg font-bold">{t(messages.music.componentErrorTitle)}</h3>
          <p className="mt-2">{t(messages.music.componentErrorMessage)}</p>
          <p className="mt-2 font-mono text-xs" role="status" aria-live="polite">{statusMessage}</p>
          <button type="button" className="brut-btn mt-4" onClick={retry}>
            {t(messages.music.componentErrorRetry)}
          </button>
        </div>
      )}
    >
      <MusicBrowser />
    </MusicErrorBoundary>
  );
}

function MusicBrowser() {
  const t = useTranslations();
  const [adminKey, setAdminKey] = useState("");
  useEffect(() => { setAdminKey(readText("clm_admin_key") ?? ""); }, []);
  const releases = useAlbums();
  const tracks = useSongs();
  const { ready: serverReady, elapsed } = useServerWarmup();
  const albums = releases.albums.filter(hasLinks);
  const entries: CatalogEntry[] = [
    ...albums.map((album) => ({
      kind: "album" as const,
      key: `album:${album.id}`,
      album,
    })),
    ...tracks.songs.map((song) => ({
      kind: "track" as const,
      key: `track:${song.id}`,
      song,
    })),
  ];
  const [selection, setSelection] = useState<string | null>(null);
  const [platform, setPlatform] = useState<StreamingPlatform>("soundcloud");
  const preview = useRef<HTMLElement>(null);
  const index = Math.max(
    0,
    entries.findIndex((entry) => entry.key === selection),
  );
  const selected = entries[index];
  const title =
    selected?.kind === "album" ? selected.album.title : selected?.song.title;
  const trackArtwork = entryArtwork(selected);

  const select = (entry: CatalogEntry) => {
    setSelection(entry.key);
    const bounds = preview.current?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.top > window.innerHeight / 2)) {
      preview.current?.scrollIntoView({ block: "start" });
    }
  };
  const move = (offset: number) => {
    const entry = entries[(index + offset + entries.length) % entries.length];
    if (entry) select(entry);
  };
  const row = (entry: CatalogEntry) => {
    const album = entry.kind === "album" ? entry.album : null;
    const name = entry.kind === "album" ? entry.album.title : entry.song.title;
    return (
      <button
        key={entry.key}
        type="button"
        className="music-catalog-item"
        aria-pressed={entry.key === selected?.key}
        onClick={() => select(entry)}
      >
        <span className="music-catalog-thumb" aria-hidden="true">
          {(album?.artworkUrl ?? (entry.kind === "track" ? entry.song.artworkUrl : undefined)) ? (
            <img src={album?.artworkUrl ?? (entry.kind === "track" ? entry.song.artworkUrl! : "")} alt="" loading="lazy" />
          ) : (
            "♪"
          )}
        </span>
        <span className="min-w-0">
          <span className="music-catalog-item-title" translate="no">
            {name}
          </span>
          <span className="music-catalog-item-meta">
            {entry.kind === "album"
              ? t.text(entry.album.setType ?? "album")
              : `${entry.song.duration ?? ""} · ${uploadDate.format(new Date(entry.song.createdAt))}`}
          </span>
        </span>
        <span aria-hidden="true">
          {entry.key === selected?.key ? "●" : "↗"}
        </span>
      </button>
    );
  };

  return (
    <div className="music-browser" data-music-browser>
      <nav
        className="music-preview-navigation"
        aria-label={t(messages.music.previewNavigation)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <button
          type="button"
          className="brut-btn"
          disabled={entries.length < 2}
          onClick={() => move(-1)}
          aria-label={t(messages.music.previousPreview)}
        >
          ←
        </button>
        <p
          className="music-preview-position"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {t(messages.music.previewPosition, {
            current: selected ? index + 1 : 0,
            total: entries.length,
          })}
          {title && <span translate="no">{title}</span>}
        </p>
        <button
          type="button"
          className="brut-btn"
          disabled={entries.length < 2}
          onClick={() => move(1)}
          aria-label={t(messages.music.nextPreview)}
        >
          →
        </button>
      </nav>
      <div className="music-browser-layout">
        <section
          ref={preview}
          className="music-preview"
          aria-labelledby="music-preview-title"
        >
          {selected ? (
            <>
              <header className="music-preview-header">
                <div className="music-preview-cover" aria-hidden="true">
                  {selected.kind === "album" && selected.album.artworkUrl ? (
                    <img src={selected.album.artworkUrl} alt="" />
                  ) : (
                    <span>♪</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="brut-label">
                    {t(
                      selected.kind === "album"
                        ? messages.music.releasedMusic
                        : messages.music.wipTracks,
                    )}
                  </p>
                  <h3 id="music-preview-title" translate="no">
                    {title}
                  </h3>
                  <p className="music-preview-meta" translate="no">
                    {selected.kind === "album"
                      ? selected.album.releaseDate
                      : `${selected.song.artist}${selected.song.duration ? ` · ${selected.song.duration}` : ""}`}
                  </p>
                </div>
              </header>
              {selected.kind === "album" && (
                <fieldset className="music-preview-platforms">
                  <legend className="brut-label">
                    {t(messages.music.listenOn)}
                  </legend>
                  {STREAMING_PLATFORMS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={platform === id}
                      onClick={() => setPlatform(id)}
                    >
                      {platformNames[id]}
                    </button>
                  ))}
                </fieldset>
              )}
              <div className="music-preview-content" key={selected.key}>
                {selected.kind === "album" ? (
                  <>
                    {selected.album.description && (
                      <p className="music-preview-description">
                        {selected.album.description}
                      </p>
                    )}
                    <AlbumCard album={selected.album} platform={platform} />
                  </>
                ) : (
                  <div className="music-track-preview">
                    {trackArtwork && <img src={trackArtwork} alt="" className="mb-4 aspect-square w-full max-w-64 border-2 border-brut-black object-cover" />}
                    <PlayerBar song={selected.song} />
                    {adminKey && <TrackShareControls songId={selected.song.id} adminKey={adminKey} />}
                    <TrackBlock key={selected.song.id} song={selected.song} onRate={tracks.rate} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <p id="music-preview-title" className="p-5">
              {t(messages.music.noTracksAvailable)}
            </p>
          )}
        </section>
        <aside
          className="music-catalog-list"
          aria-label={t(messages.music.browseMusic)}
        >
          <section aria-labelledby="albums-title">
            <h3 id="albums-title">
              {t(messages.music.releasedMusic)} <span>{albums.length}</span>
            </h3>
            <div className="music-catalog-rows">
              {entries.filter((entry) => entry.kind === "album").map(row)}
            </div>
            {releases.loading && (
              <p className="music-catalog-notice" role="status">
                {t(messages.music.loadingAlbums)}
              </p>
            )}
            {releases.error != null && (
              <ErrorNotice error={releases.error} onRetry={releases.reload} />
            )}
            {!releases.loading && releases.error == null && !albums.length && (
              <p className="music-catalog-notice">
                {t(messages.music.noAlbumsConnectedYet)}
              </p>
            )}
          </section>
          <section aria-labelledby="tracks-title">
            <h3 id="tracks-title">
              {t(messages.music.wipTracks)} <span>{tracks.songs.length}</span>
            </h3>
            <div className="music-catalog-rows">
              {entries.filter((entry) => entry.kind === "track").map(row)}
            </div>
            {tracks.loading && (
              <LoadingTracks serverReady={serverReady} elapsed={elapsed} />
            )}
            {!tracks.loading && tracks.error != null && (
              <ErrorNotice error={tracks.error} onRetry={tracks.reload} />
            )}
            {!tracks.loading &&
              tracks.error == null &&
              !tracks.songs.length && (
                <p className="music-catalog-notice">
                  {t(messages.music.noTracksAvailable)}
                </p>
              )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function entryArtwork(entry: CatalogEntry | undefined) {
  return entry?.kind === "track" ? entry.song.artworkUrl : undefined;
}
