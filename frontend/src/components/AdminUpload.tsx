import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { Song } from "../types";
import ErrorNotice from "./ErrorNotice";

const ADMIN_KEY_STORAGE = "clm_admin_key";

export default function AdminUpload() {
  const [adminKey, setAdminKey] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  const persistKey = (key: string) => {
    setAdminKey(key);
    if (key) localStorage.setItem(ADMIN_KEY_STORAGE, key);
    else localStorage.removeItem(ADMIN_KEY_STORAGE);
  };

  const loadSongs = useCallback(async () => {
    try {
      setSongs(await api.getSongs());
    } catch {
      /* list is secondary */
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey) return setMessage("Admin key is required.");
    if (!file) return setMessage("Select an audio file.");
    if (!title || !artist) return setMessage("Title and artist are required.");

    setBusy(true);
    setMessage("");
    setError(null);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("artist", artist);
      form.append("file", file);
      await api.uploadSong(form, adminKey);
      setTitle("");
      setArtist("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("✓ Song uploaded.");
      await loadSongs();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace(song: Song) {
    const replacement = fileInputRef.current?.files?.[0];
    if (!replacement) return setMessage("Select a file to replace the audio.");
    if (!adminKey) return setMessage("Admin key is required.");
    setBusy(true);
    setMessage("");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", replacement);
      await api.replaceSongAudio(song.id, form, adminKey);
      setMessage(`✓ Audio for "${song.title}" replaced.`);
      await loadSongs();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(song: Song) {
    if (!adminKey) return setMessage("Admin key is required.");
    if (!confirm(`Delete "${song.title}"?`)) return;
    setBusy(true);
    setMessage("");
    setError(null);
    try {
      await api.deleteSong(song.id, adminKey);
      setMessage(`✓ "${song.title}" deleted.`);
      await loadSongs();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="border-2 border-black bg-white p-6">
        <h2 className="mb-4 font-display text-2xl font-bold">upload song</h2>

        <label className="mb-3 block font-mono text-xs font-bold uppercase">
          admin key
          <input
            type="password"
            value={adminKey}
            onChange={(e) => persistKey(e.target.value)}
            placeholder="X-Admin-Key"
            className="mt-1 w-full border-2 border-black bg-neutral-100 px-3 py-2 font-mono text-sm outline-none focus:bg-brut-yellow"
          />
        </label>

        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="title"
            className="border-2 border-black bg-neutral-100 px-3 py-2 font-mono text-sm outline-none focus:bg-brut-yellow"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="artist"
            className="border-2 border-black bg-neutral-100 px-3 py-2 font-mono text-sm outline-none focus:bg-brut-yellow"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="border-2 border-black bg-neutral-100 px-3 py-2 font-mono text-sm"
          />
          <p className="font-mono text-[10px] text-gray-500">
            accepted formats: .mp3, .wav, .flac — duration is read automatically.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="brut-btn mt-2 bg-brut-yellow text-sm disabled:opacity-50"
          >
            {busy ? "uploading..." : "upload"}
          </button>
        </form>

        {message && (
          <p className="mt-4 border-2 border-black bg-black px-3 py-2 font-mono text-sm text-white">
            {message}
          </p>
        )}

        {error != null && <ErrorNotice error={error} className="mt-4" />}
      </div>

      <div className="border-2 border-black bg-neutral-100 p-6">
        <h2 className="mb-4 font-display text-2xl font-bold">songs ({songs.length})</h2>
        {songs.length === 0 && (
          <p className="font-mono text-sm text-gray-500">no songs yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li
              key={song.id}
              className="flex flex-wrap items-center justify-between gap-2 border-2 border-black bg-white p-3"
            >
              <span className="font-mono text-sm">
                <span className="font-bold">{song.title}</span> —{" "}
                <span className="normal-case">{song.artist}</span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleReplace(song)}
                  className="border-2 border-black bg-white px-2 py-1 font-mono text-xs hover:bg-brut-yellow"
                >
                  replace audio
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(song)}
                  className="border-2 border-black bg-black px-2 py-1 font-mono text-xs text-white hover:bg-brut-red"
                >
                  delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
