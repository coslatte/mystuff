import { useTranslations } from "../lib/i18n/useTranslations";
import { useState } from "react";
import type { Song } from "../types";
import { player } from "../services/player";
import { usePlayer } from "../hooks/usePlayer";
import { playPauseClass, playPauseGlyph } from "../lib/playback-ui";
import StarRating from "./StarRating";
import CommentThread from "./CommentThread";

type Props = {
  song: Song;
  onRate: (song: Song, stars: number) => void;
};

export default function TrackBlock({ song, onRate }: Props) {
  const t = useTranslations();
  const { track } = usePlayer();
  // Comments are fetched when the row is expanded, so a long track list does not
  // fire one request per row on load.
  const [showComments, setShowComments] = useState(false);

  const active = track.song?.id === song.id;
  const showPause = active && track.isPlaying;
  const ratingLabel =
    song.avgRating != null ? `${song.avgRating.toFixed(1)} (${song.totalVotes ?? 0})` : "unrated";

  function handlePlay() {
    if (active) player.toggle(song);
    else player.playSong(song);
  }

  return (
    <div className={`border-2 bg-brut-surface ${active ? "border-brut-blue" : "border-brut-black"}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={handlePlay}
          aria-label={t.text(showPause ? "pause" : "play")}
          className={playPauseClass(
            showPause,
            "flex h-10 w-10 shrink-0 items-center justify-center border-2 border-brut-black text-sm font-bold"
          )}
        >
          {t.text(playPauseGlyph(showPause))}
        </button>

        <div className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-bold leading-tight">
            {song.title}
          </span>
          <span className="block truncate font-mono text-xs normal-case text-brut-muted">
            {song.artist}
            {song.duration && ` · ${song.duration}`}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[10px] font-bold text-brut-muted">★ {t.text(ratingLabel)}</span>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
            className="font-mono text-[10px] text-brut-muted underline hover:text-brut-black"
          >
            {t.text(showComments ? "hide comments ▲" : "comments ▼")}
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <StarRating
          value={song.myRating ?? 0}
          onRate={(stars) => onRate(song, stars)}
        />
        {showComments && <CommentThread songId={song.id} />}
      </div>
    </div>
  );
}
