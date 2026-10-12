import { useEffect, useState } from "react";
import { api } from "../services/api";

const MAX_HEALTH_ATTEMPTS = 30;
const HEALTH_RETRY_MS = 3000;

export type ServerWarmup = {
  /** The health probe answered, so the backend is awake. */
  ready: boolean;
  /** Seconds since the probe started, for the loading copy. */
  elapsed: number;
};

/**
 * Tracks whether the backend has woken up.
 *
 * Free hosting parks the API between requests, so the first call of a visit can
 * hang for a minute. The probe retries on a budget so a server that never wakes
 * stops being polled instead of holding the request forever. `elapsed` lets the
 * loading copy describe which stage of the wait it is in.
 */
export function useServerWarmup(): ServerWarmup {
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const ping = async () => {
      try {
        await api.health();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled && attempts++ < MAX_HEALTH_ATTEMPTS) {
          retry = setTimeout(ping, HEALTH_RETRY_MS);
        }
      }
    };
    ping();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, []);

  useEffect(() => {
    if (ready) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [ready]);

  return { ready, elapsed };
}
