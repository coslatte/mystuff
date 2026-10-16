import { useCallback, useEffect, useMemo, useState } from "react";

export type Resource<T> = {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  setData: (update: (previous: T) => T) => void;
  reload: () => Promise<void>;
};

type Scope<T> = {
  load: (signal: AbortSignal) => Promise<T>;
  controller: AbortController | null;
  disposed: boolean;
};

type ResourceState<T> = {
  scope: Scope<T>;
  data: T | undefined;
  loading: boolean;
  error: unknown;
};

// The fixed-length dependency list identifies the resource, not the loader closure.
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[] = []
): Resource<T> {
  const scope = useMemo<Scope<T>>(() => ({ load, controller: null, disposed: false }), deps);
  const [state, setState] = useState<ResourceState<T>>({ scope, data: undefined, loading: true, error: null });

  const setData = useCallback((update: (previous: T) => T) => {
    if (scope.disposed) return;
    setState(previous => previous.scope !== scope || previous.data === undefined
      ? previous : { ...previous, data: update(previous.data) });
  }, [scope]);

  const reload = useCallback(async () => {
    if (scope.disposed) return;
    scope.controller?.abort();
    const controller = new AbortController();
    scope.controller = controller;
    const isCurrent = () => !scope.disposed && !controller.signal.aborted && scope.controller === controller;
    setState(previous => ({ scope, data: previous.scope === scope ? previous.data : undefined, loading: true, error: null }));
    try {
      const data = await scope.load(controller.signal);
      if (isCurrent()) setState({ scope, data, loading: false, error: null });
    } catch (error) {
      if (isCurrent()) setState(previous => ({ ...previous, loading: false, error }));
    }
  }, [scope]);

  useEffect(() => {
    scope.disposed = false;
    void reload();
    return () => {
      scope.disposed = true;
      scope.controller?.abort();
    };
  }, [scope, reload]);

  const current = state.scope === scope ? state : { data: undefined, loading: true, error: null };
  return { data: current.data, loading: current.loading, error: current.error, setData, reload };
}
