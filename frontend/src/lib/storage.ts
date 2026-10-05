/*
 * Browser storage access.
 *
 * Every caller needs the same three guards, so they live here once: server-side
 * rendering has no `localStorage`, private-mode Safari throws on write rather
 * than returning false, and a corrupted value must never take the page down.
 */

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Blocked by browser settings: treat storage as unavailable, not as an error.
    return null;
  }
}

export function readText(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Quota exceeded or storage disabled: the value stays in memory only.
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* nothing to undo */
  }
}

/**
 * Reads a JSON object. Anything that is not a plain object (a raw string left
 * by an older build, `null`, an array) falls back rather than being trusted.
 */
export function readJson<T extends object>(key: string, fallback: T): T {
  const raw = readText(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...fallback, ...(parsed as T) };
    }
  } catch {
    // Corrupted storage: start fresh.
  }
  return fallback;
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeText(key, JSON.stringify(value));
  } catch {
    // Circular structure: not worth reporting to a user.
  }
}