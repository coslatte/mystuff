import { useCallback, useRef, useState } from "react";
import { api, ApiError } from "../services/api";
import { checkAudioFile, titleFromFilename } from "../lib/audio-file";

export type QueueStatus = "queued" | "uploading" | "done" | "failed";

export type QueueItem = {
  id: string;
  file: File;
  title: string;
  artist: string;
  status: QueueStatus;
  /** 0-100, or null while the browser cannot measure the body length. */
  percent: number | null;
  error: unknown;
};

export type RejectedFile = { name: string; reason: string };

/** Two at a time: enough to keep the connection busy, few enough not to stall. */
const CONCURRENCY = 2;

/**
 * Describes which required metadata is still missing, or null when both are set.
 *
 * `artist` legitimately arrives blank: the default-artist field starts empty and
 * the row lets you fill it in afterwards. Sending it anyway is what produced the
 * useless "Malformed request." from the server — an empty multipart part is
 * indistinguishable from a missing one to Spring, so it never reaches the guard
 * in `SongService` that would have said "Artist is required."
 */
function missingMeta(item: QueueItem): string | null {
  const missing: string[] = [];
  if (!item.title.trim()) missing.push("title");
  if (!item.artist.trim()) missing.push("artist");
  if (missing.length === 0) return null;
  return `Fill in the ${missing.join(" and ")} before uploading.`;
}

let sequence = 0;
const nextId = () => `upload-${(sequence += 1)}`;

/**
 * A queue of files waiting to be uploaded, each with its own status.
 *
 * The single `busy` flag this replaced disabled every control in the page, so
 * there was no way to tell which row was in flight. Progress is real bytes sent:
 * `fetch` cannot report that, so `api.uploadSong` goes over XHR.
 */
export function useUploadQueue(adminKey: string, onAllSettled: () => Promise<void>) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);

  // The pump decides what to send next from inside an async continuation, so it
  // needs a value that is correct at that moment. React state captured during
  // render is stale by then; this ref is mutated in the same tick as setItems.
  const itemsRef = useRef<QueueItem[]>([]);
  const inFlight = useRef(0);
  const settled = useRef(false);

  const commit = useCallback((next: QueueItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<QueueItem>) => {
      commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...change } : item)));
    },
    [commit]
  );

  const addFiles = useCallback(
    (files: File[], artist: string) => {
      const accepted: QueueItem[] = [];
      const refused: RejectedFile[] = [];

      for (const file of files) {
        const check = checkAudioFile(file);
        if (!check.ok) {
          refused.push({ name: file.name, reason: check.reason });
          continue;
        }
        accepted.push({
          id: nextId(),
          file,
          title: titleFromFilename(file.name),
          artist,
          status: "queued",
          percent: 0,
          error: null,
        });
      }

      if (accepted.length) commit([...itemsRef.current, ...accepted]);
      if (refused.length) setRejected((prev) => [...prev, ...refused]);
    },
    [commit]
  );

  const remove = useCallback(
    (id: string) => {
      commit(itemsRef.current.filter((item) => item.id !== id));
    },
    [commit]
  );

  const clearFinished = useCallback(() => {
    commit(itemsRef.current.filter((item) => item.status !== "done"));
    setRejected([]);
  }, [commit]);

  const setMeta = useCallback(
    (id: string, change: { title?: string; artist?: string }) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item) return;
      const next: QueueItem = { ...item, ...change };
      // A row parked on missing metadata re-enters the queue as soon as it is
      // filled in. Without this the local error is deliberately not retryable, so
      // there would be no button left that could resubmit it.
      const parkedLocally = item.status === "failed" && !(item.error instanceof ApiError);
      if (parkedLocally && !missingMeta(next)) {
        patch(id, { ...change, status: "queued", percent: 0, error: null });
        return;
      }
      patch(id, change);
    },
    [patch]
  );

  const pump = useCallback(async () => {
    while (inFlight.current < CONCURRENCY) {
      const next = itemsRef.current.find((item) => item.status === "queued");
      if (!next) break;

      // Checked before the item is marked in-flight, so a row parked on missing
      // metadata never occupies a slot and never spends a request. Flipping it to
      // "failed" also moves the search past it, so the loop still terminates.
      const missing = missingMeta(next);
      if (missing) {
        patch(next.id, { status: "failed", error: new Error(missing) });
        continue;
      }

      inFlight.current += 1;
      patch(next.id, { status: "uploading", percent: 0, error: null });

      try {
        const form = new FormData();
        form.append("title", next.title);
        form.append("artist", next.artist);
        form.append("file", next.file);
        await api.uploadSong(form, adminKey, ({ percent }) =>
          patch(next.id, { percent })
        );
        patch(next.id, { status: "done", percent: 100, error: null });
      } catch (error) {
        patch(next.id, { status: "failed", error });
      } finally {
        inFlight.current -= 1;
      }
    }

    // One refresh once the whole batch drains, not one per file.
    if (inFlight.current === 0 && itemsRef.current.some((item) => item.status === "done")) {
      if (!settled.current) {
        settled.current = true;
        await onAllSettled();
        settled.current = false;
      }
    }
  }, [adminKey, patch, onAllSettled]);

  const start = useCallback(() => {
    void pump();
  }, [pump]);

  const retry = useCallback(
    (id: string) => {
      patch(id, { status: "queued", percent: 0, error: null });
      void pump();
    },
    [patch, pump]
  );

  const retryAll = useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.status === "failed") patch(item.id, { status: "queued", percent: 0, error: null });
    }
    void pump();
  }, [patch, pump]);

  return {
    items,
    rejected,
    addFiles,
    remove,
    setMeta,
    start,
    retry,
    retryAll,
    clearFinished,
    queued: items.filter((item) => item.status === "queued").length,
    uploading: items.filter((item) => item.status === "uploading").length,
    done: items.filter((item) => item.status === "done").length,
    failed: items.filter((item) => item.status === "failed").length,
    busy: items.some((item) => item.status === "queued" || item.status === "uploading"),
  };
}