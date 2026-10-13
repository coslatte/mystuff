import { useState } from "react";
import type { StreamingPlatform } from "../types";
import { hasLinks, STREAMING_PLATFORMS } from "../data/streaming-albums";
import { useAlbums } from "../hooks/useAlbums";
import { useServerWarmup } from "../hooks/useServerWarmup";
import { useSongs } from "../hooks/useSongs";
import PlayerBar from "./PlayerBar";
import TrackBlock from "./TrackBlock";
import AlbumCard from "./AlbumCard";
import ErrorNotice from "./ErrorNotice";
import LoadingTracks from "./LoadingTracks";

export default function MusicSection() {
  const { songs, loading, error, reload, rate } = useSongs();
  const { ready: serverReady, elapsed } = useServerWarmup();
  const { albums, loading: albumsLoading, error: albumsError, reload: reloadAlbums } = useAlbums();
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<StreamingPlatform>("soundcloud");

  const playable = albums.filter(hasLinks);

  return (
    <div className="border-b-2 border-black">
      <section className="flex flex-col gap-4 border-b-2 border-black bg-black p-4 tablet:p-6 laptop:p-8">
        <PlayerBar />
      </section>

      <div className="grid grid-cols-1 laptop:grid-cols-2">
        <section className="flex flex-col border-b-2 border-black laptop:border-b-0 laptop:border-r-2">
          <div className="flex flex-col gap-2 border-b-2 border-black bg-white p-3 tablet:flex-row tablet:flex-wrap tablet:items-center tablet:justify-between">
            <h3 className="font-display text-lg font-bold laptop:text-xl">albums</h3>
            <div className="flex items-center gap-1">
              <span className="shrink-0 font-mono text-[10px] font-bold">listen on</span>
              {STREAMING_PLATFORMS.map((platformId) => (
                <button
                  key={platformId}
                  type="button"
                  onClick={() => setPlatform(platformId)}
                  aria-pressed={platform === platformId}
                  className={`flex-1 border-2 border-black px-2 py-1.5 font-mono text-[11px] font-bold transition-colors tablet:flex-none tablet:py-1 laptop:text-[10px] ${
                    platform === platformId
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-black hover:text-white"
                  }`}
                >
                  {platformId}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-neutral-100 p-3 tablet:p-4 laptop:p-5">
            {albumsLoading && <p className="font-mono text-xs">loading albums...</p>}
            {albumsError != null && <ErrorNotice error={albumsError} onRetry={reloadAlbums} />}
            {!albumsLoading && !albumsError && !playable.length && (
              <p className="font-mono text-xs text-gray-500">no albums connected yet.</p>
            )}
            {playable.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                platform={platform}
                open={openAlbumId === album.id}
                onToggle={() => setOpenAlbumId((current) => (current === album.id ? null : album.id))}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col">
          <h3 className="border-b-2 border-black bg-brut-red text-white p-3 font-display text-lg font-bold laptop:text-xl">
            tracks
          </h3>
          <div className="flex flex-col gap-2 bg-neutral-100 p-3 tablet:p-4 laptop:p-5">
            {songs.map((song) => (
              <TrackBlock key={song.id} song={song} onRate={rate} />
            ))}
            {loading && <LoadingTracks serverReady={serverReady} elapsed={elapsed} />}
            {!loading && error != null && <ErrorNotice error={error} onRetry={reload} />}
            {!loading && error == null && !songs.length && (
              <p className="p-3 font-mono text-xs text-gray-500">No tracks available.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
