import { messages } from "../../lib/i18n/catalog";
import { useTranslations } from "../../hooks/useTranslations";
import { useCallback, useEffect, useRef } from "react";
import {
  activeLink,
  embedHeightFor,
  embedSrcFor,
  spotifyEmbedUrl,
  type PlayableAlbum,
} from "../../data/streaming-albums";
import { mountSoundCloud, mountSpotify } from "../../services/embed-players";
import type { StreamingPlatform } from "../../types";

type Props = {
  album: PlayableAlbum;
  platform: StreamingPlatform;
  open: boolean;
  onToggle?: () => void;
  /** When false the card is always expanded and has no collapse affordance. */
  collapsible?: boolean;
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
  iframe.setAttribute("data-cursor-hide", "");
  iframe.setAttribute("data-cursor-skip", "");
  return iframe;
}

export default function AlbumCard({ album, platform, open, onToggle, collapsible = true }: Props) {
  const t = useTranslations();
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
    if (link.platform !== "soundcloud") return;
    const iframe = soundCloudRef.current;
    if (!iframe) return;
    return mountSoundCloud(iframe, { key: `sc:${album.id}`, fallbackTitle: album.title });
  }, [open, album.id, album.title, link.platform, link.url, spotifyHeight]);

  return (
    <div className="brut-panel min-w-0">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={collapsible ? onToggle : undefined}
          disabled={!collapsible}
          aria-expanded={collapsible ? open : true}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-brut-blue hover:text-brut-on-accent focus-visible:bg-brut-blue focus-visible:text-brut-on-accent disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-inherit"
        >
          <span className="block h-14 w-14 shrink-0 overflow-hidden border-2 border-brut-black bg-brut-inverse laptop:h-16 laptop:w-16">
            {album.artworkUrl ? (
              <img
                src={album.artworkUrl}
                alt={album.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-lg font-black text-brut-muted">
                ♪
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-bold leading-tight">
              {album.title}
            </span>
            <span className="font-mono text-xs text-brut-muted group-hover:text-brut-on-accent group-focus-visible:text-brut-on-accent">
              {t.text(album.setType ?? "album")}
              {album.trackCount != null && t(messages.music.trackCount, { count: album.trackCount })}
              {album.releaseDate ? ` · ${album.releaseDate}` : ""}
            </span>
          </span>
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(messages.music.openPlatformTitle, { title: album.title, platform: link.platform })}
          className="shrink-0 border-2 border-brut-black bg-brut-surface px-2 py-1 font-mono text-xs hover:bg-brut-blue hover:text-brut-on-accent"
        >↗</a>
      </div>

      {(open || !collapsible) && (
        <>
          <div className="flex items-center justify-between gap-2 border-t-2 border-brut-black bg-brut-subtle px-2 py-1">
            <span className="font-mono text-[10px] text-brut-muted">{t(messages.music.playerPlatform, { platform: link.platform })}</span>
            {fallback && (
              <span className="font-mono text-[10px] font-bold text-brut-danger">{t(messages.music.unavailablePlatform, { platform })}</span>
            )}
          </div>
          {link.platform === "spotify" ? (
            <div ref={setSpotifyHost} data-cursor-hide data-cursor-skip className="w-full border-t-2 border-brut-black [&>iframe]:w-full" />
          ) : link.platform === "soundcloud" ? (
            <iframe
              ref={soundCloudRef}
              data-cursor-hide
              data-cursor-skip
              title={t(messages.music.playerTitle, { title: album.title })}
              allow={EMBED_ALLOW}
              loading="lazy"
              className="block w-full border-t-2 border-brut-black"
              style={{ height: `${soundCloudHeight}px` }}
              src={embedSrcFor(link)}
            />
          ) : (
            <iframe
              data-cursor-hide
              data-cursor-skip
              title={t(messages.music.playerTitle, { title: album.title })}
              loading="lazy"
              className="block w-full border-t-2 border-brut-black"
              style={{ height: `${link.platform === "apple-music" ? 450 : 352}px` }}
              src={embedSrcFor(link)}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            />
          )}
        </>
      )}
    </div>
  );
}
