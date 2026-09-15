import type { Album, AlbumLink, SoundCloudAlbum, StreamingPlatform } from "../types";

// Platform order shown in the "listen on" selector.
export const STREAMING_PLATFORMS: { id: StreamingPlatform; label: string }[] = [
  { id: "soundcloud", label: "soundcloud" },
  { id: "spotify", label: "spotify" },
];

// Spotify albums resolved through the public oEmbed endpoint (no auth):
//   https://open.spotify.com/oembed?url=<album url>
// Keyed by the normalized album title so they attach to the SoundCloud albums.
const SPOTIFY_BY_TITLE: Record<string, string> = {
  amb: "https://open.spotify.com/album/2oWurnyAaaX5rbyF6BtfEf",
  encrescendo: "https://open.spotify.com/album/6axLvvECijJ2FMCw4FwFmA",
};

// Albums that are not published on the SoundCloud account but should still be
// listed (metadata from Spotify's oEmbed response).
const STANDALONE_ALBUMS: Album[] = [
  {
    id: "spotify-encrescendo",
    title: "enCrescendo",
    artworkUrl: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0262ccfd906647f3725a013e62",
    trackCount: 8,
    releaseDate: "2026",
    setType: "album",
    links: [{ platform: "spotify", url: "https://open.spotify.com/album/6axLvvECijJ2FMCw4FwFmA" }],
  },
];

export function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function spotifyAlbumId(url: string): string | null {
  const match = url.match(/album\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export function spotifyEmbedUrl(url: string): string | null {
  const id = spotifyAlbumId(url);
  return id ? `https://open.spotify.com/embed/album/${id}?theme=0` : null;
}

// Merges the SoundCloud albums returned by the API with the extra streaming
// links, producing a single list where every album carries all its platforms.
export function toAlbums(soundcloud: SoundCloudAlbum[]): Album[] {
  const albums: Album[] = soundcloud.map((album) => {
    const links: AlbumLink[] = [{ platform: "soundcloud", url: album.url }];
    const spotify = SPOTIFY_BY_TITLE[normalizeTitle(album.title)];
    if (spotify) links.push({ platform: "spotify", url: spotify });
    return {
      id: album.id,
      title: album.title,
      artworkUrl: album.artworkUrl,
      trackCount: album.trackCount,
      releaseDate: album.releaseDate,
      setType: album.setType,
      artist: album.artist,
      links,
      embedHeight: album.embedHeight,
    };
  });

  const titles = new Set(albums.map((album) => normalizeTitle(album.title)));
  const extras = STANDALONE_ALBUMS.filter(
    (extra) => !titles.has(normalizeTitle(extra.title))
  );
  // Standalone releases (newest first) lead the list, then the SoundCloud ones.
  return [...extras, ...albums];
}

// The platform that will actually be used for an album, falling back to the
// first one it has when the globally selected platform is not available.
export function activeLink(album: Album, platform: StreamingPlatform): AlbumLink {
  return album.links.find((link) => link.platform === platform) ?? album.links[0];
}
