import { useResource } from "./useResource";
import { api } from "../services/api";
import type { Album } from "../types";
import { FEATURED_ALBUM, toAlbums } from "../data/streaming-albums";

export function useAlbums() {
  const { data, loading, error, reload } = useResource<Album[]>(async signal =>
    toAlbums(await api.getSoundCloudAlbums(signal))
  );
  const featuredMetadata = data?.find(album => album.title.toLowerCase() === FEATURED_ALBUM.title.toLowerCase());
  const featured = featuredMetadata ? { ...featuredMetadata, ...FEATURED_ALBUM } : FEATURED_ALBUM;
  const otherAlbums = (data ?? []).filter(album => album.title.toLowerCase() !== FEATURED_ALBUM.title.toLowerCase());
  return { albums: [featured, ...otherAlbums], loading, error, reload };
}
