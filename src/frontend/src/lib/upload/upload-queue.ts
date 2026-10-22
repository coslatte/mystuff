type UploadFile = {
  id: string;
  file: File;
  title: string;
  artist: string;
  artwork?: File;
};

export type QueueItem = UploadFile & (
  | { status: "queued" }
  | { status: "uploading"; percent: number | null }
  | { status: "done" }
  | { status: "failed"; failure: { kind: "metadata"; message: string } | { kind: "request"; error: unknown } }
);

export type RejectedFile = { name: string; reason: string };
export type MetadataChange = { title?: string; artist?: string; artwork?: File };
export type UploadEvent =
  | { type: "start" }
  | { type: "progress"; percent: number | null }
  | { type: "succeeded" }
  | { type: "failed"; error: unknown }
  | { type: "retry" };

function missingMetadata(item: UploadFile): string | null {
  const missing = [!item.title.trim() && "title", !item.artist.trim() && "artist"].filter(Boolean);
  return missing.length ? `Fill in the ${missing.join(" and ")} before uploading.` : null;
}

export function editUploadMetadata(item: QueueItem, change: MetadataChange): QueueItem {
  if (item.status === "uploading" || item.status === "done") return item;
  const next = { ...item, ...change };
  if (item.status !== "failed" || item.failure.kind !== "metadata") return next;
  const { id, file, title, artist, artwork } = next;
  const message = missingMetadata(next);
  return message
    ? { id, file, title, artist, artwork, status: "failed", failure: { kind: "metadata", message } }
    : { id, file, title, artist, artwork, status: "queued" };
}

export function transitionUpload(item: QueueItem, event: UploadEvent): QueueItem {
  const { id, file, title, artist, artwork } = item;
  const base = { id, file, title, artist, artwork };
  switch (event.type) {
    case "start": {
      if (item.status !== "queued") return item;
      const message = missingMetadata(item);
      return message
        ? { ...base, status: "failed", failure: { kind: "metadata", message } }
        : { ...base, status: "uploading", percent: 0 };
    }
    case "progress":
      return item.status === "uploading" ? { ...base, status: "uploading", percent: event.percent } : item;
    case "succeeded":
      return item.status === "uploading" ? { ...base, status: "done" } : item;
    case "failed":
      return item.status === "uploading"
        ? { ...base, status: "failed", failure: { kind: "request", error: event.error } } : item;
    case "retry":
      return item.status === "failed" && item.failure.kind === "request" ? { ...base, status: "queued" } : item;
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
