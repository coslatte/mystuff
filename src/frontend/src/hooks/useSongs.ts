import { useCallback } from "react";
import { api } from "../services/api";
import { runOptimistic } from "../lib/optimistic";
import { getVisitorId } from "../lib/visitor";
import { useResource } from "./useResource";
import type { Song } from "../types";

export type SongsResource = {
  songs: Song[];
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  /** Rate a song, adjusting the average locally, then reconciling. */
  rate: (song: Song, stars: number) => Promise<void>;
};

export function useSongs(): SongsResource {
  const {
    data,
    loading,
    error,
    setData: setSongs,
    reload,
  } = useResource<Song[]>(async () => api.getSongs(getVisitorId()), []);

  const rate = useCallback(
    async (song: Song, stars: number) => {
      // The row as it was before the click, so a failed request can put it back
      // exactly as the server described it.
      let before: Song | undefined;

      await runOptimistic({
        apply() {
          before = song;
          setSongs((prev) => prev.map((s) => (s.id === song.id ? applyVote(s, stars) : s)));
        },
        async commit() {
          await api.postRating(song.id, { stars, visitorId: getVisitorId() });
          const fresh = await api.getSong(song.id);
          setSongs((prev) => prev.map((s) => (s.id === fresh.id ? { ...fresh, myRating: stars } : s)));
        },
        rollback() {
          if (!before) return;
          const restore = before;
          setSongs((prev) => prev.map((s) => (s.id === restore.id ? restore : s)));
        },
        onError: () => {
          // Refetch so the averages come back from the server rather than from
          // arithmetic that may have drifted.
          void reload();
        },
      });
    },
    [setSongs, reload]
  );

  return { songs: data ?? [], loading, error, reload, rate };
}

/**
 * Recomputes a song's aggregate rating in place. Pure so the arithmetic behind
 * every rating click lives in one testable place.
 *
 * A visitor only has one vote, so the first vote adds a count and any later vote
 * replaces the previous stars instead of inflating the total.
 */
export function applyVote(song: Song, stars: number): Song {
  const total = song.totalVotes ?? 0;
  const avg = song.avgRating ?? 0;

  if (song.myRating == null) {
    return { ...song, avgRating: (avg * total + stars) / (total + 1), totalVotes: total + 1, myRating: stars };
  }

  return {
    ...song,
    avgRating: total > 0 ? avg - song.myRating / total + stars / total : stars,
    myRating: stars,
  };
}