import { useRef, useState } from "react";
import { useResource } from "../../hooks/useResource";
import { useTranslations } from "../../hooks/useTranslations";
import { messages } from "../../lib/i18n/catalog";
import { applyVote } from "../../hooks/useSongs";
import { api, ApiError } from "../../services/api";
import { getVisitorId } from "../../services/visitor";
import type { SharedTrack, Song } from "../../types";
import PlayerBar from "./PlayerBar";
import TrackBlock from "./TrackBlock";
import ErrorNotice from "../shared/ErrorNotice";
import "../../styles/music/shared-track.css";

export default function SharedTrackPage() {
  const t = useTranslations();
  const voting = useRef(false);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingError, setRatingError] = useState<unknown>(null);
  const { data: shared, loading, error, setData, reload } = useResource<SharedTrack>(signal => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) throw new ApiError("Shared track not found.", 404);
    return api.getSharedTrack(token, getVisitorId(), signal);
  }, []);

  const rate = async (song: Song, stars: number) => {
    if (!shared || voting.current) return;
    voting.current = true;
    setRatingPending(true);
    setRatingError(null);
    setData(current => ({ ...current, song: applyVote(current.song, stars) }));
    try {
      await api.postRating(song.id, { stars, visitorId: getVisitorId() });
      await reload();
    } catch (reason) {
      setData(() => shared);
      setRatingError(reason);
    } finally {
      voting.current = false;
      setRatingPending(false);
    }
  };

  if (loading && !shared) {
    return <section className="shared-track-shell" role="status">{t(messages.music.loadingSharedTrack)}</section>;
  }
  if (!shared || error instanceof ApiError && error.status === 404) {
    return (
      <section className="shared-track-shell" role="alert">
        <p>{t(messages.music.sharedTrackUnavailable)}</p>
        {error != null && !(error instanceof ApiError && error.status === 404) && <ErrorNotice error={error} onRetry={reload} />}
      </section>
    );
  }

  const song = shared.song;
  return (
    <section className="shared-track-shell" data-share-page>
      <article className="shared-track-card" aria-labelledby="shared-track-title">
        {song.artworkUrl && <img src={song.artworkUrl} alt="" className="shared-track-artwork" />}
        <p className="shared-track-eyebrow">{t(messages.music.wipTracks)}</p>
        <h1 id="shared-track-title" translate="no">{song.title}</h1>
        <p className="shared-track-byline" translate="no">
          {song.artist}{song.duration ? ` · ${song.duration}` : ""}
        </p>
        <div className="shared-track-player"><PlayerBar song={song} preloadWaveform={false} /></div>
        <TrackBlock key={song.id} song={song} onRate={rate} ratingDisabled={ratingPending} commentsInitiallyOpen />
        {error != null && <ErrorNotice error={error} onRetry={reload} />}
        {ratingError != null && <ErrorNotice error={ratingError} />}
      </article>
    </section>
  );
}
