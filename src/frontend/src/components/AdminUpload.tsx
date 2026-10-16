import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { runOptimistic } from "../lib/optimistic";
import { readText, removeKey, writeText } from "../lib/storage";
import { useResource } from "../hooks/useResource";
import { useUploadQueue } from "../hooks/useUploadQueue";
import { FILE_ACCEPT, formatBytes } from "../lib/audio-file";
import type { Song } from "../types";
import ErrorNotice from "./ErrorNotice";
import UploadQueue from "./UploadQueue";

const ADMIN_KEY_STORAGE = "clm_admin_key";

export default function AdminUpload() {
  const [adminKey, setAdminKey] = useState("");
  const [defaultArtist, setDefaultArtist] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  // Which song id has work in flight. A single boolean used to disable every
  // button on the page, so there was no way to tell rows apart.
  const [busySongId, setBusySongId] = useState<number | null>(null);

  const { data, error: loadError, setData: setSongs, reload } = useResource<Song[]>(
    signal => api.getSongs(undefined, signal),
    []
  );
  const songs = data ?? [];

  const queue = useUploadQueue(adminKey, reload);

  useEffect(() => {
    const saved = readText(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  const persistKey = (key: string) => {
    setAdminKey(key);
    if (key) writeText(ADMIN_KEY_STORAGE, key);
    else removeKey(ADMIN_KEY_STORAGE);
  };

  const handleReplace = async (song: Song, replacement: File | null) => {
    if (!adminKey) return setActionError(new Error("Admin key is required."));
    if (!replacement) return setActionError(new Error("Pick a replacement file first."));

    setNotice("");
    setActionError(null);
    setBusySongId(song.id);
    try {
      const form = new FormData();
      form.append("file", replacement);
      await api.replaceSongAudio(song.id, form, adminKey);
      await reload();
      setNotice(`✓ Audio for "${song.title}" replaced (${formatBytes(replacement.size)}).`);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusySongId(null);
    }
  };

  const handleDelete = async (song: Song) => {
    if (!adminKey) return setActionError(new Error("Admin key is required."));
    if (!confirm(`Delete "${song.title}"?`)) return;
    setNotice("");
    setActionError(null);

    const deleted = await runOptimistic({
      apply: () => setSongs((prev) => prev.filter((s) => s.id !== song.id)),
      async commit() {
        await api.deleteSong(song.id, adminKey);
      },
      rollback: () => void reload(),
      onError: setActionError,
    });
    if (deleted) setNotice(`✓ "${song.title}" deleted.`);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="brut-panel p-6">
        <h2 className="mb-4 font-display text-2xl font-bold">upload songs</h2>

        <label className="brut-label mb-4 block">
          admin key
          <input
            type="password"
            value={adminKey}
            onChange={(e) => persistKey(e.target.value)}
            placeholder="X-Admin-Key"
            className="brut-field-quiet mt-1 w-full px-3 py-2 text-sm"
          />
        </label>

        <UploadQueue
          items={queue.items}
          rejected={queue.rejected}
          defaultArtist={defaultArtist}
          queued={queue.queued}
          uploading={queue.uploading}
          done={queue.done}
          failed={queue.failed}
          busy={queue.busy}
          disabled={!adminKey}
          onAddFiles={(files) => queue.addFiles(files, defaultArtist)}
          onArtistChange={setDefaultArtist}
          onMetaChange={queue.setMeta}
          onRemove={queue.remove}
          onStart={queue.start}
          onRetry={queue.retry}
          onRetryAll={queue.retryAll}
          onClear={queue.clearFinished}
        />

        {!adminKey && (
          <p className="brut-meta mt-3 text-brut-muted">enter the admin key to enable uploading.</p>
        )}

        {notice && (
          <p className="mt-4 border-2 border-brut-black bg-brut-inverse px-3 py-2 font-mono text-sm text-brut-on-accent">
            {notice}
          </p>
        )}

        {actionError != null && <ErrorNotice error={actionError} className="mt-4" />}
        {queue.error != null && <ErrorNotice error={queue.error} className="mt-4" />}
      </div>

      <div className="border-2 border-brut-black bg-brut-subtle p-6">
        <h2 className="mb-4 font-display text-2xl font-bold">songs ({songs.length})</h2>
        {loadError != null && <ErrorNotice error={loadError} onRetry={reload} className="mb-3" />}
        {songs.length === 0 && <p className="font-mono text-sm text-brut-muted">no songs yet.</p>}
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              busy={busySongId === song.id}
              onReplace={handleReplace}
              onDelete={handleDelete}
            />
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
    <li className="flex flex-wrap items-center justify-between gap-2 border-2 border-brut-black bg-brut-surface p-3">
      <span className="font-mono text-sm">
        <span className="font-bold">{song.title}</span> ·{" "}
        <span className="normal-case">{song.artist}</span>
        {song.duration && <span className="text-brut-muted"> · {song.duration}</span>}
      </span>
      <span className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT}
          aria-label={`replacement audio for ${song.title}`}
          onChange={(e) => setReplacement(e.target.files?.[0] ?? null)}
          className="max-w-40 font-mono text-[10px]"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onReplace(song, replacement)}
          className="border-2 border-brut-black bg-brut-surface px-2 py-1 font-mono text-xs hover:bg-brut-blue hover:text-brut-on-accent disabled:opacity-50"
        >
          {busy ? "subiendo..." : "replace"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(song)}
          className="border-2 border-brut-black bg-brut-inverse px-2 py-1 font-mono text-xs text-brut-on-accent hover:bg-brut-red disabled:opacity-50"
        >
          delete
        </button>
      </span>
      {replacement && (
        <p className="brut-meta w-full text-brut-muted">
          {replacement.name} · {formatBytes(replacement.size)}
        </p>
      )}
    </li>
  );
}
