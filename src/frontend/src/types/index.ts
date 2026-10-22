import type { components } from "./api/schema";

/*
 * The API contract.
 *
 * `Song`, `Comment`, `Rating`, `SoundCloudAlbum` and `Health` are not written by
 * hand: they alias the OpenAPI schema that springdoc generates from the Spring
 * DTOs, so renaming a Java record field breaks the type check here instead of
 * silently becoming `undefined` at runtime. Regenerate with `bun run gen:api`
 * after changing any DTO or controller signature.
 */
export type Song = components["schemas"]["SongResponse"];
export type Comment = components["schemas"]["CommentResponse"] & {
  /**
   * Only ever present on a comment the visitor created, and only from
   * `CreatedCommentResponse`: the public listing omits it on purpose.
   */
  editToken?: string;
};
export type CreatedComment = components["schemas"]["CreatedCommentResponse"];
export type Rating = components["schemas"]["RatingResponse"];
export type SoundCloudAlbum = components["schemas"]["SoundCloudAlbumDto"];
export type Health = components["schemas"]["HealthResponse"];
export type SharedTrack = components["schemas"]["SharedTrackResponse"];
export type ClientErrorReport = components["schemas"]["ClientErrorReportRequest"];

/** The envelope every endpoint answers with. */
export type ApiMeta = {
  errorId?: string;
  status?: number;
  timestamp?: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string | null;
  data?: T | null;
  meta?: ApiMeta | null;
  errors?: unknown;
};

/*
 * Everything below is client-side domain, not an API shape.
 *
 * The API sends one album record carrying both platform URLs; `toAlbums` splits
 * them into links, and the rest models the UI's own view of a release.
 */
export type StreamingPlatform = "soundcloud" | "spotify" | "youtube-music" | "apple-music";

export type AlbumLink = {
  platform: StreamingPlatform;
  url: string;
};

export type Album = Omit<SoundCloudAlbum, "url" | "spotifyUrl"> & {
  links: AlbumLink[];
  description?: string;
};
