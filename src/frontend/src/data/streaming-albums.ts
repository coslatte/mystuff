import type { Album, AlbumLink, SoundCloudAlbum, StreamingPlatform } from "../types";

// Order shown in the "listen on" selector.
export const STREAMING_PLATFORMS: StreamingPlatform[] = ["soundcloud", "spotify", "youtube-music", "apple-music"];

export const FEATURED_ALBUM: Album = {
  id: "m0tion",
  title: "m0Tion",
  setType: "album",
  links: [
    { platform: "spotify", url: "https://open.spotify.com/album/5mXZrAK3715JxoJrzSNQtF?si=0S-37FfpRZi6IAy73pPh-A" },
    { platform: "youtube-music", url: "https://music.youtube.com/playlist?list=OLAK5uy_nm8swcmR4kB1pVhsfly7eQGYg9NVHssB4&si=01lWSdERGk5Qlp9Z" },
    { platform: "apple-music", url: "https://music.apple.com/us/album/m0tion/6818121227" },
    { platform: "soundcloud", url: "https://soundcloud.com/cosmiclattemusic/sets/m0tion" },
  ],
};

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
  if (link.platform === "spotify") return spotifyEmbedUrl(link.url);
  if (link.platform === "soundcloud") return soundCloudEmbedUrl(link.url);
  if (link.platform === "apple-music") return link.url.replace("music.apple.com", "embed.music.apple.com");
  const list = new URL(link.url).searchParams.get("list");
  return list ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}` : link.url;
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

// Spotify does not size to the track count the way SoundCloud does. Its widget
// is a fixed 200px header plus a track list that scrolls internally
// (TrackList_wrapper is overflow-y:auto inside a grid row of 1fr), so the iframe
// only sets the viewport and the height never depends on how many tracks there
// are. Its own oEmbed reports 352px for every album regardless, which is the
// value to use. Anything taller just leaves empty space under the widget.
const SP_EMBED_PX = 352;

const BOTTOM_BUFFER_PX = 8;

export function embedHeightFor(album: Album, platform: StreamingPlatform): number {
  if (platform === "spotify") return SP_EMBED_PX;
  const trackCount = album.trackCount ?? 0;
  if (trackCount <= 0) return album.embedHeight ?? SC_FALLBACK_PX;
  return Math.max(SC_MIN_PX, SC_HEADER_PX + trackCount * SC_ROW_PX + BOTTOM_BUFFER_PX);
}
