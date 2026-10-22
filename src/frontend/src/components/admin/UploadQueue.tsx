import { useRef, useState } from "react";
import { ACCEPT_HINT, FILE_ACCEPT, formatBytes } from "../../lib/upload/audio-file";
import { isRetryable, userMessage } from "../../services/errors";
import type { QueueItem, RejectedFile } from "../../lib/upload/upload-queue";

type Props = {
  items: QueueItem[];
  rejected: RejectedFile[];
  defaultArtist: string;
  queued: number;
  uploading: number;
  done: number;
  failed: number;
  busy: boolean;
  disabled: boolean;
  onAddFiles: (files: File[]) => void;
  onArtistChange: (artist: string) => void;
  onMetaChange: (id: string, change: { title?: string; artist?: string; artwork?: File }) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  onRetry: (id: string) => void;
  onRetryAll: () => void;
  onClear: () => void;
};

const STATUS_LABEL: Record<QueueItem["status"], string> = {
  queued: "en cola",
  uploading: "subiendo",
  done: "listo",
  failed: "falló",
};

const STATUS_CLASS: Record<QueueItem["status"], string> = {
  queued: "bg-brut-surface text-brut-black",
  uploading: "bg-brut-blue text-brut-on-accent",
  done: "bg-brut-green text-brut-on-accent",
  failed: "bg-brut-red text-brut-on-accent",
};

export default function UploadQueue({
  items,
  rejected,
  defaultArtist,
  queued,
  uploading,
  done,
  failed,
  busy,
  disabled,
  onAddFiles,
  onArtistChange,
  onMetaChange,
  onRemove,
  onStart,
  onRetry,
  onRetryAll,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const retryable = items.filter(item => item.status === "failed"
    && item.failure.kind === "request" && isRetryable(item.failure.error)).length;

  const takeFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onAddFiles(Array.from(list));
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-brut-black bg-brut-blue text-brut-on-accent" : "border-brut-line bg-brut-subtle"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          onChange={(e) => {
            takeFiles(e.target.files);
            // Clearing lets the same file be picked again after a failure.
            e.target.value = "";
          }}
          className="sr-only"
          id="queue-input"
          disabled={disabled}
        />
        <label htmlFor="queue-input" className="cursor-pointer">
          <span className="block font-display text-lg font-bold">
            {dragging ? "suéltalos aquí" : "arrastra los archivos aquí"}
          </span>
          <span className="brut-meta mt-1 block text-brut-muted">{ACCEPT_HINT}</span>
        </label>
      </div>

      <label className="brut-label block">
        artista por defecto
        <input
          value={defaultArtist}
          onChange={(e) => onArtistChange(e.target.value)}
          placeholder="se aplica a los archivos nuevos, puedes cambiarlo por fila"
          className="brut-field-quiet mt-1 w-full px-3 py-2 text-sm"
        />
      </label>

      {rejected.length > 0 && (
        <ul className="flex flex-col gap-1 border-2 border-brut-red bg-brut-red p-3 font-mono text-xs text-brut-on-accent">
          {rejected.map((entry) => (
            <li key={`${entry.name}-${entry.reason}`}>
              <span className="font-bold">{entry.name}</span>: {entry.reason}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-brut-black bg-brut-surface px-3 py-2 font-mono text-xs">
            <span>
              {uploading > 0 ? `subiendo ${uploading}` : "en cola"} · {done} listo
              {done === 1 ? "" : "s"} · {failed} con error
            </span>
            <span className="flex gap-2">
              {queued > 0 && (
                <button
                  type="button"
                  onClick={onStart}
                  disabled={disabled}
                  className="brut-btn !px-2 !py-1 text-xs disabled:opacity-50"
                >
                  subir {queued}
                </button>
              )}
              {retryable > 1 && (
                <button
                  type="button"
                  onClick={onRetryAll}
                  className="border-2 border-brut-black bg-brut-surface px-2 py-1 font-bold hover:bg-brut-blue hover:text-brut-on-accent"
                >
                  reintentar todo
                </button>
              )}
              {!busy && (done > 0 || rejected.length > 0) && (
                <button
                  type="button"
                  onClick={onClear}
                  className="border-2 border-brut-black bg-brut-surface px-2 py-1 font-bold hover:bg-brut-red hover:text-brut-on-accent"
                >
                  limpiar
                </button>
              )}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                disabled={disabled}
                onMetaChange={onMetaChange}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type RowProps = {
  item: QueueItem;
  disabled: boolean;
  onMetaChange: (id: string, change: { title?: string; artist?: string; artwork?: File }) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

function QueueRow({ item, disabled, onMetaChange, onRemove, onRetry }: RowProps) {
  const locked = item.status === "done" || item.status === "uploading";
  const failure = item.status === "failed" ? item.failure : null;
  const message = failure?.kind === "metadata" ? failure.message
    : failure?.kind === "request" ? userMessage(failure.error) : null;

  return (
    <li className="flex flex-col gap-2 border-2 border-brut-black bg-brut-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1 font-mono text-xs">
          <span className="block truncate font-bold">{item.file.name}</span>
          <span className="text-brut-muted">{formatBytes(item.file.size)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`border-2 border-brut-black px-2 py-0.5 font-mono text-[10px] font-bold ${STATUS_CLASS[item.status]}`}
          >
            {STATUS_LABEL[item.status]}
            {item.status === "uploading" && item.percent != null ? ` ${item.percent}%` : ""}
          </span>
          {failure?.kind === "request" && isRetryable(failure.error) && (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              className="border-2 border-brut-black bg-brut-surface px-2 py-0.5 font-mono text-[10px] font-bold hover:bg-brut-blue hover:text-brut-on-accent"
            >
              reintentar
            </button>
          )}
          {!locked && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`quitar ${item.file.name}`}
              className="border-2 border-brut-black bg-brut-surface px-2 py-0.5 font-mono text-[10px] hover:bg-brut-red hover:text-brut-on-accent"
            >
              quitar
            </button>
          )}
        </span>
      </div>

      {item.status === "uploading" && (
        <div
          role="progressbar"
          aria-label={`subiendo ${item.file.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.percent ?? undefined}
          className="h-3 border-2 border-brut-black bg-brut-surface"
        >
          {/*
            No percentage is available when the body length is unknown, so the
            bar stays empty rather than inventing progress.
          */}
          {item.percent != null && (
            <div className="h-full bg-brut-red transition-[width]" style={{ width: `${item.percent}%` }} />
          )}
        </div>
      )}

      {message && <p className="font-mono text-[10px] text-brut-danger">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <input
          value={item.title}
          onChange={(e) => onMetaChange(item.id, { title: e.target.value })}
          disabled={locked || disabled}
          placeholder="title"
          aria-label={`título de ${item.file.name}`}
          className="brut-field min-w-0 flex-1 px-2 py-1 text-xs disabled:opacity-60"
        />
        <input
          value={item.artist}
          onChange={(e) => onMetaChange(item.id, { artist: e.target.value })}
          disabled={locked || disabled}
          placeholder="artist"
          aria-label={`artista de ${item.file.name}`}
          className="brut-field min-w-0 flex-1 px-2 py-1 text-xs disabled:opacity-60"
        />
      </div>
      <label className="font-mono text-[10px]">
        portada (JPG ≤ 2 MB / PNG ≤ 6 MB)
        <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" disabled={locked || disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const limit = file.type === "image/png" ? 6 * 1024 * 1024 : 2 * 1024 * 1024;
            if (!(file.type === "image/png" || file.type === "image/jpeg") || file.size > limit) {
              window.alert("Choose a JPG up to 2 MB or PNG up to 6 MB.");
              event.target.value = "";
              return;
            }
            onMetaChange(item.id, { artwork: file });
          }} className="ml-2 max-w-48" />
      </label>
    </li>
  );
}
