import { useState } from "react";
import type { Song } from "../types";
import { player } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";
import StarRating from "./StarRating";
import CommentThread from "./CommentThread";

type Props = {
  song: Song;
  onRate: (song: Song, stars: number) => void;
};

export default function TrackBlock({ song, onRate }: Props) {
  const { song: currentSong, isPlaying } = usePlayer();
  const [showComments, setShowComments] = useState(true);

  const active = currentSong?.id === song.id;
  const showPause = active && isPlaying;
  const ratingLabel =
    song.avgRating != null ? `${song.avgRating.toFixed(1)} (${song.totalVotes ?? 0})` : "—";

  function handlePlay() {
    if (active) player.toggle();
    else player.playSong(song);
  }

  return (
    <div className={`border-2 border-black bg-white ${active ? "bg-brut-yellow" : ""}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={handlePlay}
          aria-label={showPause ? "pause" : "play"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black font-bold ${
            showPause ? "bg-brut-red text-white" : "bg-white text-black hover:bg-brut-yellow"
          }`}
        >
          {showPause ? "‖" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-bold leading-tight">
            {song.title}
          </span>
          <span className="block truncate font-mono text-xs normal-case text-gray-600">
            {song.artist}
            {song.duration ? ` · ${song.duration}` : ""}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[10px] font-bold text-gray-500">★ {ratingLabel}</span>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="font-mono text-[10px] text-gray-400 underline hover:text-black"
          >
            {showComments ? "hide comments" : "comments"}
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <StarRating
          value={song.totalVotes ? Math.round(song.avgRating ?? 0) : 0}
          onRate={(stars) => onRate(song, stars)}
        />
        {showComments && <CommentThread songId={song.id} />}
      </div>
    </div>
  );
}
