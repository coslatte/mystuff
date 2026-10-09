/*
 * Audio file checks, mirrored from the server.
 *
 * `FileStorageService.validate` rejects on extension, on content type and on
 * size. Checking the first and last here means a 20 MB file is refused before it
 * travels instead of after. The limits are duplicated on purpose: they are
 * constants in two languages, and the alternative is a round trip to find out.
 */

/** `app.upload-max-bytes` in the backend, default 20971520. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** `FileStorageService.ALLOWED_EXTENSIONS`. */
export const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".flac"] as const;

/** Mirrors `FileStorageService.ALLOWED_CONTENT_TYPES`. */
export const ALLOWED_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/flac",
  "audio/x-flac",
  "audio/vnd.wave",
] as const;

const ACCEPT = `${ALLOWED_EXTENSIONS.join(",")},${ALLOWED_CONTENT_TYPES.join(",")}`;

/** Value for the `accept` attribute. */
export const FILE_ACCEPT = ACCEPT;

export const ACCEPT_HINT = ".mp3, .wav or .flac, up to 20 MB. duration is read automatically.";

export type FileCheck = { ok: true } | { ok: false; reason: string };

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/**
 * Rejects anything the server would reject. An empty content type is allowed
 * through: some browsers omit it, and the extension is the deterministic check.
 * A *wrong* content type is still refused, because the server refuses it.
 */
export function checkAudioFile(file: File): FileCheck {
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { ok: false, reason: `Unsupported format ${extension || "(none)"}. Use .mp3, .wav or .flac.` };
  }

  if (file.type && !ALLOWED_CONTENT_TYPES.includes(file.type.toLowerCase() as (typeof ALLOWED_CONTENT_TYPES)[number])) {
    return { ok: false, reason: `Unsupported media type ${file.type}. Use .mp3, .wav or .flac.` };
  }

  if (file.size === 0) {
    return { ok: false, reason: "The file is empty." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `${formatBytes(file.size)} exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`,
    };
  }

  return { ok: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Guesses a title from the filename: `02 - my_great track.mp3` becomes
 * `my great track`. Saves typing the obvious part of every row.
 */
export function titleFromFilename(name: string): string {
  const base = name.slice(0, name.length - extensionOf(name).length);
  return base
    .replace(/^\s*\d+\s*[-._)]\s*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}