import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { getVisitorId } from "../lib/visitor";
import type { Album, Song, StreamingPlatform } from "../types";
import { activeLink, spotifyEmbedUrl, STREAMING_PLATFORMS, toAlbums } from "../data/streaming-albums";
import { usePlayer } from "../hooks/usePlayer";
import PlayerBar from "./PlayerBar";
import TrackBlock from "./TrackBlock";
import ErrorNotice from "./ErrorNotice";
import LoadingTracks from "./LoadingTracks";

// SoundCloud's oEmbed always reports 450px for a set, which leaves empty space
// under short albums and clips long ones. The widget renders a fixed header
// (artwork + playlist title + controls) followed by one ~32px row per track, so
// we derive the height from the track count and let the container grow with it.
const SC_HEADER_PX = 100;
const SC_TRACK_ROW_PX = 32;
const SC_MIN_HEIGHT_PX = 180;
const SC_BOTTOM_BUFFER_PX = 8;

// Spotify's album embed ships a fixed 352px frame.
const SPOTIFY_EMBED_HEIGHT = 352;

function albumEmbedHeight(album: Album): number {
  const trackCount = album.trackCount ?? 0;
  if (trackCount > 0) {
    return Math.max(
      SC_MIN_HEIGHT_PX,
      SC_HEADER_PX + trackCount * SC_TRACK_ROW_PX + SC_BOTTOM_BUFFER_PX
    );
  }
  return album.embedHeight ?? 450;
}

function soundCloudEmbedUrl(albumUrl: string) {
  const params = new URLSearchParams({
    url: albumUrl,
    color: "#ff5500",
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export default function MusicSection() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [userRatings, setUserRatings] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [albumsError, setAlbumsError] = useState<unknown>(null);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<StreamingPlatform>("soundcloud");

  // Cold-start awareness: the API may be waking up, so we surface real
  // progress (health probe answered?) instead of an opaque "loading".
  const [serverReady, setServerReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { song: currentSong } = usePlayer();

  const loadSongs = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.getSongs(getVisitorId());
      setSongs(data);
      const ratings: Record<number, number> = {};
      for (const song of data) {
        if (song.myRating != null) ratings[song.id] = song.myRating;
      }
      setUserRatings(ratings);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlbums = useCallback(async () => {
    setAlbumsLoading(true);
    setAlbumsError(null);
    try {
      setAlbums(toAlbums(await api.getSoundCloudAlbums()));
    } catch (e) {
      setAlbumsError(e);
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs();
    loadAlbums();
  }, [loadSongs, loadAlbums]);

  // Poll the public health endpoint until the server answers. Each failed
  // probe is retried, so a cold backend eventually flips this to ready; the
  // retry budget is capped so a permanently down API never polls forever.
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const ping = async () => {
      try {
        await api.health();
        if (!cancelled) setServerReady(true);
      } catch {
        if (!cancelled && attempts++ < MAX_ATTEMPTS) {
          retry = setTimeout(ping, 3000);
        }
      }
    };
    ping();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, []);

  // Seconds since the track fetch began, used to pick an honest message.
  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [loading]);

  const handleRate = useCallback(async (song: Song, stars: number) => {
    const visitor = getVisitorId();
    const previous = userRatings[song.id];
    const isFirstVote = previous === undefined;

    // optimistic update: a visitor only has one vote, so the first vote adds
    // a count and any later vote replaces the previous stars (no inflation).
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== song.id) return s;
        const total = s.totalVotes ?? 0;
        const avg = s.avgRating ?? 0;
        const totalVotes = isFirstVote ? total + 1 : total;
        const avgRating = isFirstVote
          ? (avg * total + stars) / totalVotes
          : avg - (previous ?? 0) / total + stars / total;
        return { ...s, avgRating, totalVotes, myRating: stars };
      })
    );
    setUserRatings((prev) => ({ ...prev, [song.id]: stars }));

    try {
      await api.postRating(song.id, { stars, visitorId: visitor });
      // reconcile with the authoritative value from the server
      const fresh = await api.getSong(song.id);
      setSongs((prev) => prev.map((s) => (s.id === fresh.id ? { ...fresh, myRating: stars } : s)));
    } catch (e) {
      setSongs((prev) => prev.map((s) => (s.id === song.id ? song : s)));
      setUserRatings((prev) => {
        const next = { ...prev };
        if (isFirstVote) delete next[song.id];
        else next[song.id] = previous as number;
        return next;
      });
      setError(e);
    }
  }, [userRatings]);

  if (loading) {
    return <LoadingTracks serverReady={serverReady} elapsed={elapsed} />;
  }
  if (error) {
    return <ErrorNotice error={error} onRetry={loadSongs} className="border-b-2" />;
  }

  return (
    <div className="border-b-2 border-black">
      <section className="flex flex-col gap-4 border-b-2 border-black bg-black p-4 tablet:p-6 laptop:p-8">
        <div className="border-2 border-black bg-black p-3">
          {currentSong ? (
            <p className="font-mono text-xs font-bold leading-tight normal-case text-white">
              <span className="text-brut-red">{currentSong.title}</span>
              <span className="text-white">
                {currentSong.artist ? ` · ${currentSong.artist}` : ""}
                {currentSong.duration ? ` · ${currentSong.duration}` : ""}
              </span>
            </p>
          ) : (
            <p className="font-mono text-xs font-bold normal-case text-white">select a track</p>
          )}
        </div>
        <div className="hidden laptop:block">
          <PlayerBar />
        </div>
      </section>

      <div className="grid grid-cols-1 laptop:grid-cols-2">
        <section className="flex flex-col border-b-2 border-black laptop:border-b-0 laptop:border-r-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-brut-yellow p-3">
            <h3 className="font-display text-lg font-bold laptop:text-xl">albums</h3>
            <div className="flex items-center gap-1">
              <span className="hidden font-mono text-[10px] font-bold sm:inline">listen on</span>
              {STREAMING_PLATFORMS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPlatform(option.id)}
                  aria-pressed={platform === option.id}
                  className={`border-2 border-black px-2 py-1 font-mono text-[10px] font-bold transition-colors ${
                    platform === option.id
                      ? "bg-black text-white"
                      : "bg-white hover:bg-black hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-neutral-100 p-3 tablet:p-4 laptop:p-5">
            {albumsLoading && <p className="font-mono text-xs">loading albums...</p>}
            {albumsError != null && <ErrorNotice error={albumsError} onRetry={loadAlbums} />}
            {!albumsLoading && !albumsError && !albums.length && (
              <p className="font-mono text-xs text-gray-500">no albums connected yet.</p>
            )}
            {albums.map((album) => {
              const open = openAlbumId === album.id;
              const link = activeLink(album, platform);
              const embedSrc =
                link.platform === "spotify" ? spotifyEmbedUrl(link.url) : soundCloudEmbedUrl(link.url);
              const embedHeight =
                link.platform === "spotify" ? SPOTIFY_EMBED_HEIGHT : albumEmbedHeight(album);
              return (
                <div key={album.id} className="border-2 border-black bg-white">
                  <div className="flex items-center gap-2 p-2">
                    <button
                      type="button"
                      onClick={() => setOpenAlbumId(open ? null : album.id)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-brut-yellow"
                    >
                      <span className="block h-14 w-14 shrink-0 overflow-hidden border-2 border-black bg-black laptop:h-16 laptop:w-16">
                        {album.artworkUrl ? (
                          <img src={album.artworkUrl} alt={album.title} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-lg font-black text-neutral-600">
                            {album.title.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-base font-bold leading-tight">
                          {album.title}
                        </span>
                        <span className="font-mono text-xs text-gray-600">
                          {album.setType ?? "album"}
                          {album.trackCount != null ? ` · ${album.trackCount} tracks` : ""}
                          {album.releaseDate ? ` · ${album.releaseDate}` : ""}
                        </span>
                      </span>
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`open ${album.title} on ${link.platform}`}
                      className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs hover:bg-brut-yellow"
                    >
                      ↗
                    </a>
                  </div>
                  {open && (
                    <>
                      <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-neutral-100 px-2 py-1">
                        <span className="font-mono text-[10px] text-gray-600">
                          playing from {link.platform}
                        </span>
                        {link.platform !== platform && (
                          <span className="font-mono text-[10px] font-bold text-brut-red">
                            not on {platform}
                          </span>
                        )}
                      </div>
                      {embedSrc && (
                        <iframe
                          title={`${album.title} player`}
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          scrolling="no"
                          className="block w-full border-t-2 border-black"
                          style={{ height: `${embedHeight}px` }}
                          src={embedSrc}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col">
          <h3 className="border-b-2 border-black bg-brut-yellow p-3 font-display text-lg font-bold laptop:text-xl">
            tracks
          </h3>
          <div className="flex flex-col gap-2 bg-neutral-100 p-3 tablet:p-4 laptop:p-5">
            {songs.map((song) => (
              <TrackBlock
                key={song.id}
                song={song}
                userRating={userRatings[song.id]}
                onRate={handleRate}
              />
            ))}
            {!songs.length && <p className="p-3 font-mono text-xs text-gray-500">no tracks yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
