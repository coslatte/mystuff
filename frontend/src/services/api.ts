import { PUBLIC_API_URL } from "astro:env/client";
import type {
  ApiEnvelope,
  Comment,
  CreatedComment,
  Health,
  Rating,
  Song,
  SoundCloudAlbum,
} from "../types";

// Typed and defaulted by `env.schema` in astro.config.mjs.
const API_URL = PUBLIC_API_URL;

export class ApiError extends Error {
  readonly status: number;
  readonly errorId?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, errorId?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorId = errorId;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { adminKey?: string; editToken?: string }
): Promise<T> {
  const { adminKey, editToken, headers, body, ...rest } = init ?? {};
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string> | undefined) };
  if (adminKey) finalHeaders["X-Admin-Key"] = adminKey;
  // The edit token is a bearer secret, so it travels in a header instead of the
  // query string where it would land in access logs and Referer headers.
  if (editToken) finalHeaders["X-Edit-Token"] = editToken;
  if (body && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
  }
  const finalInit: RequestInit = {
    ...rest,
    headers: finalHeaders,
    body,
  };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, finalInit);
  } catch (cause) {
    throw new ApiError("Network request failed.", 0, undefined, cause);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: ApiEnvelope<T> | undefined;
  try {
    payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : undefined;
  } catch {
    payload = undefined;
  }

  if (!res.ok) {
    const errorId = payload?.meta?.errorId ?? res.headers.get("X-Error-Id") ?? undefined;
    throw new ApiError(
      payload?.message || `Request failed: ${res.status}`,
      res.status,
      errorId,
      payload?.errors
    );
  }
  return payload?.data as T;
}

export const api = {
  health: () => request<Health>("/health"),
  getSongs: (visitorId?: string) =>
    request<Song[]>(`/api/songs${visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ""}`),
  getSong: (songId: number) => request<Song>(`/api/songs/${songId}`),
  getComments: (songId: number) => request<Comment[]>(`/api/songs/${songId}/comments`),
  postComment: (songId: number, body: { author: string; content: string }) =>
    request<CreatedComment>(`/api/songs/${songId}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postRating: (songId: number, body: { stars: number; visitorId: string }) =>
    request<Rating>(`/api/songs/${songId}/ratings`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getSoundCloudAlbums: () => request<SoundCloudAlbum[]>("/api/albums/soundcloud"),

  uploadSong: (form: FormData, adminKey: string) =>
    request<Song>("/api/songs", { method: "POST", body: form, adminKey }),
  replaceSongAudio: (songId: number, form: FormData, adminKey: string) =>
    request<Song>(`/api/songs/${songId}/audio`, { method: "PUT", body: form, adminKey }),
  deleteSong: (songId: number, adminKey: string) =>
    request<void>(`/api/songs/${songId}`, { method: "DELETE", adminKey }),

  // Answers with CommentResponse (no token): the caller keeps the one it
  // already holds locally.
  updateComment: (commentId: number, content: string, opts?: { adminKey?: string; editToken?: string }) =>
    request<Comment>(`/api/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
      adminKey: opts?.adminKey,
      editToken: opts?.editToken,
    }),
};
