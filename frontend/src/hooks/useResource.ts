import { useCallback, useEffect, useState } from "react";

export type Resource<T> = {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  /** Patch the loaded value in place, for optimistic updates and rollbacks. */
  setData: (update: (previous: T) => T) => void;
  reload: () => Promise<void>;
};

/**
 * One loading/error/reload lifecycle for every remote read, replacing the copy
 * that used to live in `useAlbums`, `MusicSection`, `CommentThread` and
 * `AdminUpload`.
 *
 * `load` is deliberately not part of the effect's dependencies: callers pass a
 * fresh closure on every render, so depending on it would loop forever. Pass a
 * fixed-length `deps` array instead, listing whatever the read actually keys
 * off (an id, a visitor id). Changing its length between renders breaks React's
 * dependency bookkeeping, so keep it static at each call site.
 */
export function useResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[] = []
): Resource<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const patch = useCallback((update: (previous: T) => T) => {
    setData((previous) => (previous === undefined ? previous : update(previous)));
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setData(await load());
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, setData: patch, reload };
}