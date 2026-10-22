import { useState } from "react";
import { messages } from "../../lib/i18n/catalog";
import { useTranslations } from "../../hooks/useTranslations";
import type { Song } from "../../types";
import StarRating from "./StarRating";
import CommentThread from "./CommentThread";

type Props = {
  song: Song;
  onRate: (song: Song, stars: number) => void;
};

export default function TrackBlock({ song, onRate }: Props) {
  const t = useTranslations();
  // Browsing previews must not fetch comments until the listener asks for them.
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(song.commentCount ?? 0);
  const rating = song.avgRating != null ? `${song.avgRating.toFixed(1)} (${song.totalVotes ?? 0})` : t(messages.music.unrated);

  return (
    <div className="music-track-feedback">
      <div className="music-track-feedback-header">
        <StarRating value={song.myRating ?? 0} onRate={stars => onRate(song, stars)} />
        <span className="font-mono text-xs text-brut-muted">★ {rating}</span>
        <button type="button" className="editorial-link" aria-expanded={showComments}
          onClick={() => setShowComments(value => !value)}>
          {t(messages.music.comments)} ({commentCount}) <span aria-hidden="true">{showComments ? "▲" : "▼"}</span>
        </button>
      </div>
      {showComments && <CommentThread songId={song.id} onCountChange={setCommentCount} />}
    </div>
  );
}
