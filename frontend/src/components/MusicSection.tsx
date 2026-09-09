import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import type { Comment, Song } from "../types";
import SongCard from "./SongCard";
import StarRating from "./StarRating";
import CommentForm from "./CommentForm";

export default function MusicSection() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const current = songs.find((song) => song.id === currentId) ?? null;

  const loadSongs = useCallback(async () => {
    const data = await api.getSongs();
    setSongs(data);
    setCurrentId((prev) => prev ?? data[0]?.id ?? null);
  }, []);

  const loadComments = useCallback(async (songId: number) => {
    setComments(await api.getComments(songId));
  }, []);

  useEffect(() => {
    loadSongs()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [loadSongs]);

  useEffect(() => {
    if (currentId != null) loadComments(currentId).catch((e) => setError((e as Error).message));
  }, [currentId, loadComments]);

  async function handleRate(stars: number) {
    if (!current) return;
    try {
      await api.postRating(current.id, { stars });
      await loadSongs();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p className="border-black bg-white p-6 font-mono text-sm">loading tracks...</p>;
  if (error) return <p className="border-black bg-brut-red p-6 font-mono text-sm text-white">{error}</p>;
  if (!current) return <p className="border-black bg-white p-6 font-mono text-sm">no tracks available.</p>;

  return (
    <div className="grid grid-cols-1 border-b-2 border-black lg:grid-cols-12">
      <section className="flex flex-col justify-between gap-4 border-b-2 border-black bg-black p-6 lg:col-span-7 lg:border-b-0 lg:border-r-2">
        <div>
          <span className="mb-4 inline-block bg-brut-yellow px-2 py-0.5 font-mono text-xs font-bold text-black">
            now playing — {current.title}
          </span>
          <h2 className="font-display text-3xl font-black text-white">{current.title}</h2>
          <p className="mt-1 font-mono text-sm text-neutral-300">
            {current.artist} · {current.duration ?? "—"}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold text-black">
            ★ {current.avgRating?.toFixed(1) ?? "—"} ({current.totalVotes ?? 0})
          </div>
          {current.audioUrl ? (
            <audio key={current.id} src={current.audioUrl} controls autoPlay className="w-full max-w-md border-2 border-black" />
          ) : (
            <span className="border-2 border-black bg-neutral-300 px-3 py-2 font-mono text-xs">no preview</span>
          )}
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

      <section className="border-b-2 border-black bg-neutral-100 p-6 lg:col-span-12">
        <h3 className="mb-4 font-display text-xl font-bold">tracklist</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} active={song.id === current.id} onSelect={(s) => setCurrentId(s.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}
