import { useResource } from "./useResource";
import { api } from "../services/api";
import type { Album } from "../types";
import { toAlbums } from "../data/streaming-albums";

export function useAlbums() {
  const { data, loading, error, reload } = useResource<Album[]>(async () =>
    toAlbums(await api.getSoundCloudAlbums())
  );
  return { albums: data ?? [], loading, error, reload };
}