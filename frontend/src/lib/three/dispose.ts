/*
 * Scene teardown.
 *
 * A WebGL scene owns three things the garbage collector will not reclaim: an
 * animation loop that keeps scheduling itself, GPU buffers behind geometries and
 * materials, and the context itself. A scene that skips teardown keeps rendering
 * into a detached canvas and the tab's GPU memory never comes back.
 *
 * Every scene collects its own cleanup here, so the next one does not have to
 * rediscover the list.
 */

export type SceneCleanup = () => void;

/**
 * Registry a scene fills as it builds, then runs in one call to drop.
 *
 * `release` is idempotent and re-entrancy safe on purpose: a scene can be torn
 * down by its own deadline and again by the page unloading, and disposing a
 * renderer twice logs errors.
 */
export function createCleanupRegistry(): { release: SceneCleanup; add: (fn: SceneCleanup) => void } {
  const pending: SceneCleanup[] = [];
  let released = false;

  return {
    add(fn) {
      if (released) {
        fn();
        return;
      }
      pending.push(fn);
    },
    release() {
      if (released) return;
      released = true;
      // Reverse order: later steps may depend on earlier ones still existing, so
      // undoing them first keeps teardown valid.
      while (pending.length > 0) {
        const fn = pending.pop();
        try {
          fn?.();
        } catch {
          // Teardown is best effort. One failing disposer must not strand the
          // rest, which is why each one is isolated instead of chained.
        }
      }
    },
  };
}

/**
 * Throttles a per-frame render to the refresh rate budget implied by `fps`.
 *
 * The splash draws a handful of flat rectangles; rendering every rAF tick on a
 * 144Hz display doubles the work for no visible gain.
 */
export function frameBudget(fps: number): number {
  return 1000 / Math.max(1, fps);
}
