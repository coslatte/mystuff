import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { Comment, Song, SoundCloudAlbum } from "../types";
import AudioPlayer, { type AudioPlayerHandle } from "./AudioPlayer";
import SongCard from "./SongCard";
import StarRating from "./StarRating";
import CommentForm from "./CommentForm";

type Tab = "tracks" | "wip" | "albums";

const TABS: { id: Tab; label: string }[] = [
  { id: "tracks", label: "tracks" },
  { id: "wip", label: "wip" },
  { id: "albums", label: "albums" },
];

export default function MusicSection() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("tracks");
  const [isPlaying, setIsPlaying] = useState(false);

  const [albums, setAlbums] = useState<SoundCloudAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [albumsError, setAlbumsError] = useState("");

  const playerRef = useRef<AudioPlayerHandle>(null);
  const current = songs.find((song) => song.id === currentId) ?? null;

  const loadSongs = useCallback(async () => {
    const data = await api.getSongs();
    setSongs(data);
    setCurrentId((prev) => prev ?? data[0]?.id ?? null);
  }, []);

  const loadComments = useCallback(async (songId: number) => {
    setComments(await api.getComments(songId));
  }, []);

  const loadAlbums = useCallback(async () => {
    setAlbumsLoading(true);
    setAlbumsError("");
    try {
      setAlbums(await api.getSoundCloudAlbums());
    } catch (e) {
      setAlbumsError((e as Error).message);
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [loadSongs]);

  useEffect(() => {
    if (currentId != null) loadComments(currentId).catch((e) => setError((e as Error).message));
  }, [currentId, loadComments]);

  useEffect(() => {
    if (tab === "albums") loadAlbums();
  }, [tab, loadAlbums]);

  async function handleRate(stars: number) {
    if (!current) return;
    try {
      await api.postRating(current.id, { stars });
      await loadSongs();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleSelect(song: Song) {
    if (song.id === currentId && isPlaying) {
      playerRef.current?.toggle();
    } else {
      setCurrentId(song.id);
      playerRef.current?.playSong(song);
    }
  }

  if (loading) return <p className="border-black bg-white p-6 font-mono text-sm">loading tracks...</p>;
  if (error) return <p className="border-black bg-brut-red p-6 font-mono text-sm text-white">{error}</p>;
  if (!current) return <p className="border-black bg-white p-6 font-mono text-sm">no tracks available.</p>;

  return (
    <div className="border-b-2 border-black">
      <div className="grid grid-cols-1 border-b-2 border-black lg:grid-cols-12">
        <section className="flex flex-col justify-between gap-4 border-b-2 border-black bg-black p-6 lg:col-span-7 lg:border-b-0 lg:border-r-2">
          <div>
            {isPlaying && (
              <span className="mb-4 inline-block bg-brut-yellow px-2 py-0.5 font-mono text-xs font-bold text-black">
                now playing — {current.title}
              </span>
            )}
            <h2 className="font-display text-3xl font-black text-white">{current.title}</h2>
            <p className="mt-1 font-mono text-sm text-neutral-300">
              {current.artist} · {current.duration ?? "—"}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold text-black">
                ★ {current.avgRating?.toFixed(1) ?? "—"} ({current.totalVotes ?? 0})
              </div>
            </div>
            <AudioPlayer ref={playerRef} song={current} onPlayingChange={setIsPlaying} />
          </div>
        </section>

        <section className="flex flex-col border-b-2 border-black lg:col-span-5">
          <div className="flex items-center justify-between border-b-2 border-black bg-brut-yellow p-4">
            <h3 className="font-display text-xl font-bold">rating</h3>
            <StarRating value={current.totalVotes ? Math.round(current.avgRating ?? 0) : 0} onRate={handleRate} />
          </div>

          <div className="flex flex-1 flex-col gap-6 p-6">
            <div>
              <h3 className="mb-4 font-display text-xl font-bold">comments</h3>
              <CommentForm songId={current.id} onCreated={() => loadComments(current.id)} />
            </div>

            <ul className="flex flex-col border-t-2 border-black">
              {comments.map((comment) => (
                <li key={comment.id} className="border-b-2 border-black py-3">
                  <p className="font-mono text-xs font-bold">{comment.author}</p>
                  <p className="mt-1 text-sm text-gray-700">{comment.content}</p>
                </li>
              ))}
              {!comments.length && <li className="py-3 font-mono text-sm text-gray-500">be the first to comment.</li>}
            </ul>
          </div>
        </section>
      </div>

      <nav className="flex border-b-2 border-black bg-neutral-100 font-mono text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 border-r-2 border-black px-6 py-3 font-bold last:border-r-0 ${
              tab === t.id ? "bg-brut-yellow" : "hover:bg-brut-red hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="border-b-2 border-black bg-neutral-100 p-6">
        {tab === "tracks" && (
          <div>
            <h3 className="mb-4 font-display text-xl font-bold">tracklist</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {songs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  active={song.id === current.id}
                  isPlaying={isPlaying}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "wip" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              "demos & experiments",
              "drafts / rough cuts",
              "unsorted uploads",
            ].map((label) => (
              <div key={label} className="flex min-h-40 flex-col items-center justify-center gap-2 border-2 border-dashed border-black bg-white p-6 text-center">
                <span className="font-display text-2xl font-black">wip</span>
                <span className="font-mono text-xs text-gray-600">{label}</span>
                <span className="font-mono text-[10px] text-gray-400">empty — coming soon</span>
              </div>
            ))}
          </div>
        )}

        {tab === "albums" && (
          <div>
            <h3 className="mb-4 font-display text-xl font-bold">albums & compilations</h3>
            {albumsLoading && <p className="font-mono text-sm">loading albums...</p>}
            {albumsError && <p className="font-mono text-sm text-brut-red">{albumsError}</p>}
            {!albumsLoading && !albumsError && albums.length === 0 && (
              <p className="font-mono text-sm text-gray-600">no albums connected yet. set up soundcloud and they'll appear here.</p>
            )}
            {albums.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {albums.map((album) => (
                  <a
                    key={album.id}
                    href={album.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col border-2 border-black bg-white p-4 transition-colors hover:bg-brut-yellow"
                  >
                    <span className="mb-3 block aspect-square w-full overflow-hidden border-2 border-black bg-black">
                      {album.artworkUrl ? (
                        <img src={album.artworkUrl} alt={album.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-3xl font-black text-neutral-600">
                          {album.title}
                        </span>
                      )}
                    </span>
                    <span className="font-display text-lg font-bold leading-tight">{album.title}</span>
                    <span className="mt-1 font-mono text-xs text-gray-600">
                      {album.setType ?? "album"}
                      {album.trackCount != null ? ` · ${album.trackCount} tracks` : ""}
                      {album.releaseDate ? ` · ${album.releaseDate}` : ""}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
