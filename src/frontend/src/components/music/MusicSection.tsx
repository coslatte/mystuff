import { messages } from "../../lib/i18n/catalog";
import { useTranslations } from "../../hooks/useTranslations";
import { useState } from "react";
import type { StreamingPlatform } from "../../types";
import { hasLinks, STREAMING_PLATFORMS, type PlayableAlbum } from "../../data/streaming-albums";
import { useAlbums } from "../../hooks/useAlbums";
import { useServerWarmup } from "../../hooks/useServerWarmup";
import { useSongs } from "../../hooks/useSongs";
import PlayerBar from "./PlayerBar";
import TrackBlock from "./TrackBlock";
import AlbumCard from "./AlbumCard";
import ErrorNotice from "../shared/ErrorNotice";
import LoadingTracks from "../loading/LoadingTracks";

export default function MusicSection() {
  const t = useTranslations();
  const { albums, loading, error, reload } = useAlbums();
  const playable = albums.filter(hasLinks);
  const latest = playable[0];
  const [selectedAlbumId, setOpenAlbumId] = useState<string | null>();
  const openAlbumId = selectedAlbumId === undefined ? latest?.id : selectedAlbumId;
  const [platform, setPlatform] = useState<StreamingPlatform>("soundcloud");

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-brut-black bg-brut-surface p-3">
        <span className="font-mono text-xs">{t(messages.music.listenOn)}</span>
        {STREAMING_PLATFORMS.map((platformId) => (
          <button key={platformId} type="button" aria-pressed={platform === platformId} onClick={() => setPlatform(platformId)} className={`border-2 border-brut-black px-3 py-2 font-mono text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brut-blue ${platform === platformId ? "bg-brut-inverse text-brut-on-accent" : "bg-brut-surface text-brut-black"}`}>
            {{ soundcloud: "SoundCloud", spotify: "Spotify", "youtube-music": "YouTube Music", "apple-music": "Apple Music" }[platformId]}
          </button>
        ))}
      </div>
      <section aria-labelledby="latest-title" className="grid min-w-0 grid-cols-1 border-b-2 border-brut-black laptop:grid-cols-[minmax(18rem,.8fr)_minmax(0,1.2fr)]">
        <div className="relative aspect-square max-h-[42rem] min-w-0 overflow-hidden border-r-2 border-brut-black bg-brut-inverse">
          {latest?.artworkUrl ? <img src={latest.artworkUrl} alt={`${latest.title} cover art`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-8xl font-black text-brut-on-accent" aria-hidden="true">{latest?.title.charAt(0) ?? "♪"}</span>}
          <span className="absolute bottom-0 left-0 bg-brut-red px-3 py-2 font-mono text-xs font-bold text-brut-on-accent">SELECTED RELEASE</span>
        </div>
        <div className="flex min-w-0 flex-col justify-between bg-brut-inverse p-5 text-brut-on-accent tablet:p-8 laptop:p-10">
          <div>
            <p className="brut-label text-brut-muted">Original work{latest?.releaseDate ? ` / ${latest.releaseDate}` : ""}</p>
            <h3 id="latest-title" className="mt-5 break-words font-display font-black leading-none tracking-tighter">{latest?.title ?? (loading ? "Loading releases..." : "Releases")}</h3>
            {latest?.description && <p className="mt-4 text-sm leading-7">{latest.description}</p>}
          </div>
          {latest ? (
            <div className="mt-8">
              <AlbumCard album={latest} platform={platform} open={openAlbumId === latest.id} onToggle={() => setOpenAlbumId(openAlbumId === latest.id ? null : latest.id)} />
            </div>
          ) : loading ? <p role="status" className="mt-8 font-mono text-xs text-brut-muted">Loading releases...</p>
            : error != null ? <ErrorNotice error={error} onRetry={reload} />
            : <p className="mt-8 font-mono text-xs text-brut-muted">No releases available.</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="editorial-link" href="#work-catalog">Explore more work ↓</a>
          </div>
        </div>
      </section>
      <div id="work-catalog" className="grid grid-cols-1 laptop:grid-cols-2">
        <AlbumCatalog albums={playable.filter((album) => album.id !== latest?.id)} loading={loading} error={error} reload={reload} platform={platform} openAlbumId={openAlbumId} setOpenAlbumId={setOpenAlbumId} />
        <TrackCatalog />
      </div>
    </div>
  );
}

type AlbumCatalogProps = {
  albums: PlayableAlbum[];
  loading: boolean;
  error: ReturnType<typeof useAlbums>["error"];
  reload: () => void;
  platform: StreamingPlatform;
  openAlbumId: string | null | undefined;
  setOpenAlbumId: (id: string | null) => void;
};

function AlbumCatalog({ albums, loading: albumsLoading, error: albumsError, reload: reloadAlbums, platform, openAlbumId, setOpenAlbumId }: AlbumCatalogProps) {
  const t = useTranslations();

  return (
    <section aria-labelledby="albums-title" className="flex min-w-0 flex-col border-b-2 border-brut-black laptop:border-b-0 laptop:border-r-2">
      <div className="flex min-h-16 flex-col justify-center gap-2 border-b-2 border-brut-black bg-brut-surface p-3 tablet:flex-row tablet:flex-wrap tablet:items-center tablet:justify-between">
        <h3 id="albums-title" className="font-display font-bold leading-10">{t(messages.music.albums)}</h3>
      </div>
      <div className="flex flex-col gap-2 bg-brut-subtle p-3 tablet:p-4 laptop:p-5">
        {albumsLoading && !albums.length && <p className="font-mono text-xs">{t(messages.music.loadingAlbums)}</p>}
        {albumsError != null && <ErrorNotice error={albumsError} onRetry={reloadAlbums} />}
        {!albumsLoading && !albumsError && !albums.length && (
          <p className="font-mono text-xs text-brut-muted">No other releases available.</p>
        )}
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            platform={platform}
            open={openAlbumId === album.id}
            onToggle={() => setOpenAlbumId(openAlbumId === album.id ? null : album.id)}
          />
        ))}
      </div>
    </section>
  );
}

function TrackCatalog() {
  const t = useTranslations();
  const { songs, loading, error, reload, rate } = useSongs();
  const { ready: serverReady, elapsed } = useServerWarmup();

  return (
    <section aria-labelledby="tracks-title" className="flex min-w-0 flex-col">
      <h3 id="tracks-title" className="min-h-16 border-b-2 border-brut-black bg-brut-red p-3 font-display font-bold leading-10 text-brut-on-accent">{t(messages.music.wipTracks)}</h3>
      <div className="flex flex-col gap-4 border-b-2 border-brut-black bg-brut-inverse p-4 tablet:p-6">
        <PlayerBar />
      </div>
      <div className="flex flex-col gap-2 bg-brut-subtle p-3 tablet:p-4 laptop:p-5">
        {songs.map((song) => (
          <TrackBlock key={song.id} song={song} onRate={rate} />
        ))}
        {loading && <LoadingTracks serverReady={serverReady} elapsed={elapsed} />}
        {!loading && error != null && <ErrorNotice error={error} onRetry={reload} />}
        {!loading && error == null && !songs.length && (
          <p className="p-3 font-mono text-xs text-brut-muted">{t(messages.music.noTracksAvailable)}</p>
        )}
      </div>
    </section>
  );
}
