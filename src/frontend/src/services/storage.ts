/*
 * Browser storage access.
 *
 * Every caller needs the same three guards, so they live here once: server-side
 * rendering has no `localStorage`, private-mode Safari throws on write rather
 * than returning false, and a corrupted value must never take the page down.
 */

/**
 * Resolves a storage area, or null when it cannot be used.
 *
 * Takes the area as an argument so a caller needing session lifetime can pass
 * `sessionStorage` and inherit the identical guards rather than open-coding a
 * second, less careful wrapper.
 */
function storage(area: () => Storage): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return area();
  } catch {
    // Blocked by browser settings: treat storage as unavailable, not as an error.
    return null;
  }
}

export function readText(key: string): string | null {
  try {
    return storage(() => window.localStorage)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string): void {
  try {
    storage(() => window.localStorage)?.setItem(key, value);
  } catch {
    // Quota exceeded or storage disabled: the value stays in memory only.
  }
}

export function removeKey(key: string): void {
  try {
    storage(() => window.localStorage)?.removeItem(key);
  } catch {
    /* nothing to undo */
  }
}

/**
 * Session-scoped text. Survives client-side navigation within the tab and dies
 * with it, which is what "already seen the splash once" needs.
 */
export function readSessionText(key: string): string | null {
  try {
    return storage(() => window.sessionStorage)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeSessionText(key: string, value: string): void {
  try {
    storage(() => window.sessionStorage)?.setItem(key, value);
  } catch {
    // Same degradation as writeText: in-memory only for this page.
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