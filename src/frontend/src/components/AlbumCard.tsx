import { useCallback, useEffect, useRef } from "react";
import {
  activeLink,
  embedHeightFor,
  embedSrcFor,
  spotifyEmbedUrl,
  type PlayableAlbum,
} from "../data/streaming-albums";
import { mountSoundCloud, mountSpotify } from "../services/embed-players";
import type { StreamingPlatform } from "../types";

type Props = {
  album: PlayableAlbum;
  platform: StreamingPlatform;
  open: boolean;
  onToggle: () => void;
};

const EMBED_ALLOW = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

function fallbackEmbed(title: string, src: string, height: number): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.title = `${title} player`;
  iframe.allow = EMBED_ALLOW;
  iframe.loading = "lazy";
  iframe.src = src;
  iframe.style.height = `${height}px`;
  iframe.className = "block w-full";
  return iframe;
}

export default function AlbumCard({ album, platform, open, onToggle }: Props) {
  const link = activeLink(album, platform);
  const fallback = link.platform !== platform;
  const soundCloudRef = useRef<HTMLIFrameElement>(null);
  const spotifyHostRef = useRef<HTMLDivElement>(null);
  const setSpotifyHost = useCallback((node: HTMLDivElement | null) => {
    spotifyHostRef.current = node;
  }, []);
  const spotifyHeight = embedHeightFor(album, "spotify");
  const soundCloudHeight = embedHeightFor(album, "soundcloud");

  // Deps stay primitive on purpose: a re-render that hands over a fresh album
  // object would otherwise tear the embed down and throw away its playback.
  useEffect(() => {
    if (!open) return;
    if (link.platform === "spotify") {
      const host = spotifyHostRef.current;
      if (!host) return;
      // Spotify swaps the node it is handed for its own iframe, and React throws
      // when asked to remove a node a library already replaced. The host stays
      // React-owned and empty; everything inside it is ours to discard.
      const container = document.createElement("div");
      container.append(fallbackEmbed(album.title, spotifyEmbedUrl(link.url), spotifyHeight));
      host.append(container);
      const teardown = mountSpotify(container, {
        key: `sp:${album.id}`,
        fallbackTitle: album.title,
        url: link.url,
        height: spotifyHeight,
      });
      return () => {
        teardown();
        container.remove();
      };
    }
    const iframe = soundCloudRef.current;
    if (!iframe) return;
    return mountSoundCloud(iframe, { key: `sc:${album.id}`, fallbackTitle: album.title });
  }, [open, album.id, album.title, link.platform, link.url, spotifyHeight]);

  return (
    <div className="brut-panel min-w-0">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-brut-yellow"
        >
          <span className="block h-14 w-14 shrink-0 overflow-hidden border-2 border-black bg-black laptop:h-16 laptop:w-16">
            {album.artworkUrl ? (
              <img
                src={album.artworkUrl}
                alt={album.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-lg font-black text-neutral-600">
                {album.title.charAt(0)}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold leading-tight">
              {album.title}
            </span>
            <span className="font-mono text-xs text-gray-600">
              {album.setType ?? "album"}
              {album.trackCount != null ? ` · ${album.trackCount} tracks` : ""}
              {album.releaseDate ? ` · ${album.releaseDate}` : ""}
            </span>
          </span>
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`open ${album.title} on ${link.platform}`}
          className="shrink-0 border-2 border-black bg-white px-2 py-1 font-mono text-xs hover:bg-brut-yellow"
        >
          ↗
        </a>
      </div>

      {open && (
        <>
          <div className="flex items-center justify-between gap-2 border-t-2 border-black bg-neutral-100 px-2 py-1">
            <span className="font-mono text-[10px] text-gray-600">Player: {link.platform}</span>
            {fallback && (
              <span className="font-mono text-[10px] font-bold text-brut-red">Unavailable on {platform}</span>
            )}
          </div>
          {link.platform === "spotify" ? (
            <div ref={setSpotifyHost} className="w-full border-t-2 border-black [&>iframe]:w-full" />
          ) : (
            <iframe
              ref={soundCloudRef}
              title={`${album.title} player`}
              allow={EMBED_ALLOW}
              loading="lazy"
              className="block w-full border-t-2 border-black"
              style={{ height: `${soundCloudHeight}px` }}
              src={embedSrcFor(link)}
            />
          )}
        </>
      )}
    </div>
  );
}
