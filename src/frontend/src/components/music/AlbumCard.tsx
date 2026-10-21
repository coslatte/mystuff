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

export default function AlbumCard({ album, platform }: Props) {
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
  }, [album.id, album.title, link.platform, link.url, spotifyHeight]);

  return (
    <div className="music-release-player brut-panel">
      <div className="music-release-source">
        <span>{t(messages.music.playerPlatform, { platform: link.platform })}</span>
        {fallback && <span className="text-brut-danger">{t(messages.music.unavailablePlatform, { platform })}</span>}
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="editorial-link"
          aria-label={t(messages.music.openPlatformTitle, { title: album.title, platform: link.platform })}>↗</a>
      </div>
      {link.platform === "spotify" ? (
        <div ref={setSpotifyHost} data-cursor-hide data-cursor-skip className="w-full border-t-2 border-brut-black [&>iframe]:w-full" />
      ) : link.platform === "soundcloud" ? (
        <iframe ref={soundCloudRef} data-cursor-hide data-cursor-skip
          title={t(messages.music.playerTitle, { title: album.title })}
          allow={EMBED_ALLOW} loading="lazy" className="block w-full border-t-2 border-brut-black"
          style={{ height: `${soundCloudHeight}px` }} src={embedSrcFor(link)} />
      ) : (
        <iframe data-cursor-hide data-cursor-skip title={t(messages.music.playerTitle, { title: album.title })}
          loading="lazy" className="block w-full border-t-2 border-brut-black"
          style={{ height: `${link.platform === "apple-music" ? 450 : 352}px` }} src={embedSrcFor(link)}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture" />
      )}
    </div>
  );
}
