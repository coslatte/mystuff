import { useResource } from "./useResource";
import { api } from "../services/api";
import type { Album } from "../types";
import { toAlbums } from "../data/streaming-albums";

export function useAlbums() {
  const { data, loading, error, reload } = useResource<Album[]>(async signal =>
    toAlbums(await api.getSoundCloudAlbums(signal))
  );
  return { albums: data ?? [], loading, error, reload };
}
