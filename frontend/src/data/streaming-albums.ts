import type { Album, AlbumLink, SoundCloudAlbum, StreamingPlatform } from "../types";

// Order shown in the "listen on" selector.
export const STREAMING_PLATFORMS: StreamingPlatform[] = ["soundcloud", "spotify"];

// The API sends one record per release carrying both platform URLs, so this only
// splits them into links.
export function toAlbums(releases: SoundCloudAlbum[]): Album[] {
  return releases.map(({ url, spotifyUrl, ...album }) => {
    const links: AlbumLink[] = [];
    if (url) links.push({ platform: "soundcloud", url });
    if (spotifyUrl) links.push({ platform: "spotify", url: spotifyUrl });
    return { ...album, links };
  });
}

// At least one link, so callers can index links[0] without a null check.
export type PlayableAlbum = Album & { links: [AlbumLink, ...AlbumLink[]] };

export function hasLinks(album: Album): album is PlayableAlbum {
  return album.links.length > 0;
}

// The platform that will actually be used for an album, falling back to the
// first one it has when the globally selected platform is not available.
export function activeLink(album: PlayableAlbum, platform: StreamingPlatform): AlbumLink {
  return album.links.find((link) => link.platform === platform) ?? album.links[0];
}

export function soundCloudEmbedUrl(url: string): string {
  const params = new URLSearchParams({
    url,
    color: "#ff5500",
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export function spotifyEmbedUrl(url: string): string {
  // https://open.spotify.com/album/<id> -> https://open.spotify.com/embed/album/<id>
  // theme=0 keeps the light embed, otherwise Spotify serves its own dark one.
  const embed = new URL(url.replace("/album/", "/embed/album/"));
  embed.searchParams.set("theme", "0");
  return embed.toString();
}

export function embedSrcFor(link: AlbumLink): string {
  return link.platform === "spotify" ? spotifyEmbedUrl(link.url) : soundCloudEmbedUrl(link.url);
}

// SoundCloud's oEmbed reports 450px for every set, which leaves empty space
// under short albums and clips long ones. The widget draws a fixed header
// (artwork + title + controls) then one ~32px row per track, so size the iframe
// from the track count. The header the API reports is the fallback for releases
// with no track count.
const SC_HEADER_PX = 100;
const SC_ROW_PX = 32;
const SC_MIN_PX = 180;
const SC_FALLBACK_PX = 450;

// Spotify stacks a ~232px cover/metadata header over a track list that grows
// with the iframe height, so it needs the same treatment.
const SP_HEADER_PX = 232;
const SP_ROW_PX = 32;
const SP_MIN_PX = 352;

const BOTTOM_BUFFER_PX = 8;

export function embedHeightFor(album: Album, platform: StreamingPlatform): number {
  const trackCount = album.trackCount ?? 0;
  if (platform === "spotify") {
    if (trackCount <= 0) return SP_MIN_PX;
    return Math.max(SP_MIN_PX, SP_HEADER_PX + trackCount * SP_ROW_PX + BOTTOM_BUFFER_PX);
  }
  if (trackCount <= 0) return album.embedHeight ?? SC_FALLBACK_PX;
  return Math.max(SC_MIN_PX, SC_HEADER_PX + trackCount * SC_ROW_PX + BOTTOM_BUFFER_PX);
}