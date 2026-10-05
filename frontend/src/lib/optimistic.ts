/*
 * Optimistic mutation runner.
 *
 * Ratings, comments and admin uploads all follow the same four steps: paint the
 * change, send it, reconcile with the server, and undo it if the request fails.
 * This runs those steps once so each caller only supplies its own state
 * transitions.
 *
 * Callers keep full control of their state: `apply` and `rollback` are the
 * caller's own `setState` calls, so nothing here needs to know the shape.
 */

export type OptimisticOptions = {
  /** Paint the change as if the request already succeeded. */
  apply: () => void;
  /** Send it. May reconcile with the server response before resolving. */
  commit: () => Promise<void>;
  /** Restore the previous value. Runs only when `commit` rejects. */
  rollback: () => void;
  /** Surface the failure. Never swallow it silently. */
  onError: (error: unknown) => void;
};

export async function runOptimistic(options: OptimisticOptions): Promise<boolean> {
  const { apply, commit, rollback, onError } = options;
  apply();
  try {
    await commit();
    return true;
  } catch (error) {
    rollback();
    onError(error);
    return false;
  }
}