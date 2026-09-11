import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { getVisitorId } from "../lib/visitor";
import type { Song, SoundCloudAlbum } from "../types";
import { usePlayer } from "../hooks/usePlayer";
import PlayerBar from "./PlayerBar";
import TrackBlock from "./TrackBlock";
import ErrorNotice from "./ErrorNotice";

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

  const [albums, setAlbums] = useState<SoundCloudAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [albumsError, setAlbumsError] = useState<unknown>(null);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);

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
      setAlbums(await api.getSoundCloudAlbums());
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
    return <p className="border-b-2 border-black bg-white p-6 font-mono text-sm md:p-8">loading tracks...</p>;
  }
  if (error) {
    return <ErrorNotice error={error} onRetry={loadSongs} className="border-b-2" />;
  }

  return (
    <div className="border-b-2 border-black">
      <section className="flex flex-col gap-4 border-b-2 border-black bg-black p-6">
        <div className="border-2 border-black bg-black p-3">
          {currentSong ? (
            <p className="font-mono text-xs font-bold leading-tight normal-case text-white">
              now playing —{" "}
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
        <PlayerBar />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <section className="flex flex-col border-b-2 border-black lg:border-b-0 lg:border-r-2">
          <h3 className="border-b-2 border-black bg-brut-yellow p-3 font-display text-lg font-bold">
            albums
          </h3>
          <div className="flex flex-col gap-2 bg-neutral-100 p-3">
            {albumsLoading && <p className="font-mono text-xs">loading albums...</p>}
            {albumsError != null && <ErrorNotice error={albumsError} onRetry={loadAlbums} />}
            {!albumsLoading && !albumsError && !albums.length && (
              <p className="font-mono text-xs text-gray-500">no albums connected yet.</p>
            )}
            {albums.map((album) => {
              const open = openAlbumId === album.id;
              return (
                <div key={album.id} className="border-2 border-black bg-white">
                  <div className="flex items-center gap-2 p-2">
                    <button
                      type="button"
                      onClick={() => setOpenAlbumId(open ? null : album.id)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-brut-yellow"
                    >
                      <span className="block h-14 w-14 shrink-0 overflow-hidden border-2 border-black bg-black">
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
                      href={album.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`open ${album.title} on soundcloud`}
                      className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs hover:bg-brut-yellow"
                    >
                      ↗
                    </a>
                  </div>
                  {open && (
                    <iframe
                      title={`${album.title} player`}
                      width="100%"
                      height={300}
                      allow="autoplay"
                      loading="lazy"
                      className="block border-t-2 border-black"
                      src={soundCloudEmbedUrl(album.url)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col">
          <h3 className="border-b-2 border-black bg-brut-yellow p-3 font-display text-lg font-bold">
            tracks
          </h3>
          <div className="flex flex-col gap-2 bg-neutral-100 p-3">
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
