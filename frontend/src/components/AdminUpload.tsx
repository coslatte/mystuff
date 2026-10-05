import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { runOptimistic } from "../lib/optimistic";
import { readText, removeKey, writeText } from "../lib/storage";
import { useResource } from "../hooks/useResource";
import type { Song } from "../types";
import ErrorNotice from "./ErrorNotice";

const ADMIN_KEY_STORAGE = "clm_admin_key";
const ACCEPT = ".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac";

export default function AdminUpload() {
  const [adminKey, setAdminKey] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, error: loadError, setData: setSongs, reload } = useResource<Song[]>(
    async () => api.getSongs(),
    []
  );
  const songs = data ?? [];

  useEffect(() => {
    const saved = readText(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  const persistKey = (key: string) => {
    setAdminKey(key);
    if (key) writeText(ADMIN_KEY_STORAGE, key);
    else removeKey(ADMIN_KEY_STORAGE);
  };

  // Every admin action ends the same way: clear the previous outcome, run, then
  // refresh the list. The action returns the success message.
  const runAction = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage("");
    setActionError(null);
    try {
      setMessage(await action());
      await reload();
      return true;
    } catch (err) {
      setActionError(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Validation outcomes belong in the error channel, not the success box:
  // "admin key is required" used to render identically to "✓ song uploaded".
  const reject = (message: string) => {
    setMessage("");
    setActionError(new Error(message));
  };

  const requireKey = (): boolean => {
    if (adminKey) return true;
    reject("Admin key is required.");
    return false;
  };

  async function handleUpload(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireKey()) return;
    if (!file) return reject("Select an audio file.");
    if (!title || !artist) return reject("Title and artist are required.");

    await runAction(async () => {
      const form = new FormData();
      form.append("title", title);
      form.append("artist", artist);
      form.append("file", file);
      await api.uploadSong(form, adminKey);
      setTitle("");
      setArtist("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return "✓ Song uploaded.";
    });
  }

  async function handleReplace(song: Song, replacement: File | null) {
    if (!requireKey()) return;
    if (!replacement) return reject("Pick a replacement file first.");
    await runAction(async () => {
      const form = new FormData();
      form.append("file", replacement);
      await api.replaceSongAudio(song.id, form, adminKey);
      return `✓ Audio for "${song.title}" replaced.`;
    });
  }

  async function handleDelete(song: Song) {
    if (!requireKey()) return;
    if (!confirm(`Delete "${song.title}"?`)) return;
    await runOptimistic({
      apply: () => setSongs((prev) => prev.filter((s) => s.id !== song.id)),
      async commit() {
        await api.deleteSong(song.id, adminKey);
      },
      // The row is gone for good either way, so there is nothing to restore.
      rollback: () => void reload(),
      onError: setActionError,
    });
    setMessage(`✓ "${song.title}" deleted.`);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="border-2 border-black bg-white p-6">
        <h2 className="mb-4 font-display text-2xl font-bold">upload song</h2>

<label className="brut-label mb-3 block">
            admin key
            <input
              type="password"
              value={adminKey}
              onChange={(e) => persistKey(e.target.value)}
              placeholder="X-Admin-Key"
              className="brut-field-quiet mt-1 w-full px-3 py-2 text-sm"
            />
          </label>

        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="title"
            className="brut-field-quiet px-3 py-2 text-sm"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="artist"
            className="brut-field-quiet px-3 py-2 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="border-2 border-black bg-neutral-100 px-3 py-2 font-mono text-sm"
          />
          <p className="brut-meta text-gray-500">
            accepted formats: .mp3, .wav, .flac. duration is read automatically.
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

        {actionError != null && <ErrorNotice error={actionError} className="mt-4" />}
      </div>

      <div className="border-2 border-black bg-neutral-100 p-6">
        <h2 className="mb-4 font-display text-2xl font-bold">songs ({songs.length})</h2>
        {loadError != null && <ErrorNotice error={loadError} onRetry={reload} className="mb-3" />}
        {songs.length === 0 && <p className="font-mono text-sm text-gray-500">no songs yet.</p>}
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <SongRow key={song.id} song={song} busy={busy} onReplace={handleReplace} onDelete={handleDelete} />
          ))}
        </ul>
      </div>
    </div>
  );
}

type RowProps = {
  song: Song;
  busy: boolean;
  onReplace: (song: Song, file: File | null) => void;
  onDelete: (song: Song) => void;
};

// Each row owns its replacement input. Reading a shared upload-form input here
// would upload whatever file happened to sit there.
function SongRow({ song, busy, onReplace, onDelete }: RowProps) {
  const [replacement, setReplacement] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-2 border-black bg-white p-3">
      <span className="font-mono text-sm">
        <span className="font-bold">{song.title}</span> ·{" "}
        <span className="normal-case">{song.artist}</span>
      </span>
      <span className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          aria-label={`replacement audio for ${song.title}`}
          onChange={(e) => setReplacement(e.target.files?.[0] ?? null)}
          className="max-w-40 font-mono text-[10px]"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onReplace(song, replacement)}
          className="border-2 border-black bg-white px-2 py-1 font-mono text-xs hover:bg-brut-yellow disabled:opacity-50"
        >
          replace
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(song)}
          className="border-2 border-black bg-black px-2 py-1 font-mono text-xs text-white hover:bg-brut-red disabled:opacity-50"
        >
          delete
        </button>
      </span>
    </li>
  );
}