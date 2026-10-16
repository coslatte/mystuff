import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { isRetryable } from "../services/errors";
import { checkAudioFile, titleFromFilename } from "../lib/audio-file";
import { editUploadMetadata, transitionUpload, type MetadataChange, type QueueItem, type RejectedFile, type UploadEvent } from "../lib/upload-queue";

const CONCURRENCY = 2;

function canRetry(item: QueueItem) {
  return item.status === "failed" && item.failure.kind === "request" && isRetryable(item.failure.error);
}

export function useUploadQueue(adminKey: string, onBatchUploaded: () => Promise<void>) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [error, setError] = useState<unknown>(null);
  const itemsRef = useRef<QueueItem[]>([]);
  const batch = useRef<Promise<void> | null>(null);
  const lifecycle = useRef({ disposed: false });

  useEffect(() => {
    const scope = { disposed: false };
    lifecycle.current = scope;
    return () => {
      scope.disposed = true;
      batch.current = null;
    };
  }, []);

  // Workers reserve rows synchronously before awaiting network I/O.
  const updateQueue = useCallback((update: (current: QueueItem[]) => QueueItem[]) => {
    if (lifecycle.current.disposed) return;
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const updateItem = useCallback((id: string, event: UploadEvent) => {
    updateQueue(current => current.map(item => item.id === id ? transitionUpload(item, event) : item));
  }, [updateQueue]);

  const addFiles = useCallback((files: File[], artist: string) => {
    const accepted: QueueItem[] = [];
    const refused: RejectedFile[] = [];
    for (const file of files) {
      const check = checkAudioFile(file);
      if (!check.ok) refused.push({ name: file.name, reason: check.reason });
      else accepted.push({ id: crypto.randomUUID(), file, title: titleFromFilename(file.name), artist, status: "queued" });
    }
    updateQueue(current => [...current, ...accepted]);
    if (!lifecycle.current.disposed) setRejected(previous => [...previous, ...refused]);
  }, [updateQueue]);

  const setMeta = useCallback((id: string, change: MetadataChange) => {
    updateQueue(current => current.map(item => item.id === id ? editUploadMetadata(item, change) : item));
  }, [updateQueue]);

  const remove = useCallback((id: string) => {
    updateQueue(current => current.filter(item => item.id !== id || item.status === "uploading" || item.status === "done"));
  }, [updateQueue]);

  const clearFinished = useCallback(() => {
    updateQueue(current => current.filter(item => item.status !== "done"));
    if (!lifecycle.current.disposed) setRejected([]);
  }, [updateQueue]);

  const start = useCallback(() => {
    if (batch.current || !adminKey || lifecycle.current.disposed) return;
    const scope = lifecycle.current;
    let uploaded = false;
    setError(null);

    const worker = async () => {
      while (!scope.disposed) {
        const next = itemsRef.current.find(item => item.status === "queued");
        if (!next) return;
        const reserved = transitionUpload(next, { type: "start" });
        updateQueue(current => current.map(item => item.id === next.id ? reserved : item));
        if (reserved.status !== "uploading") continue;
        const form = new FormData();
        form.append("title", reserved.title.trim());
        form.append("artist", reserved.artist.trim());
        form.append("file", reserved.file);
        try {
          await api.uploadSong(form, adminKey, ({ percent }) => {
            if (!scope.disposed) updateItem(next.id, { type: "progress", percent });
          });
          if (!scope.disposed) updateItem(next.id, { type: "succeeded" });
          uploaded = true;
        } catch (cause) {
          if (!scope.disposed) updateItem(next.id, { type: "failed", error: cause });
        }
      }
    };

    const running = Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(async () => {
      if (uploaded && !scope.disposed) await onBatchUploaded();
    });
    batch.current = running;
    void running.catch(cause => {
      if (!scope.disposed) setError(cause);
    }).finally(() => {
      if (batch.current === running) batch.current = null;
    });
  }, [adminKey, onBatchUploaded, updateItem, updateQueue]);

  const retry = useCallback((id: string) => {
    const item = itemsRef.current.find(entry => entry.id === id);
    if (!item || !canRetry(item)) return;
    updateItem(id, { type: "retry" });
    start();
  }, [start, updateItem]);

  const retryAll = useCallback(() => {
    updateQueue(current => current.map(item => canRetry(item) ? transitionUpload(item, { type: "retry" }) : item));
    start();
  }, [start, updateQueue]);

  return {
    items, rejected, error, addFiles, setMeta, remove, clearFinished, start, retry, retryAll,
    queued: items.filter(item => item.status === "queued").length,
    uploading: items.filter(item => item.status === "uploading").length,
    done: items.filter(item => item.status === "done").length,
    failed: items.filter(item => item.status === "failed").length,
    busy: items.some(item => item.status === "queued" || item.status === "uploading"),
  };
}
