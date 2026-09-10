import type { Comment, Rating, Song, SoundCloudAlbum } from "../types";

const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8080";

export type ApiMeta = {
  errorId?: string;
  status?: number;
  timestamp?: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data?: T;
  meta?: ApiMeta | null;
  errors?: unknown;
};

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
  if (body && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
  }
  const finalInit: RequestInit = {
    ...rest,
    headers: finalHeaders,
    body,
  };

  let url = `${API_URL}${path}`;
  if (editToken) url += `${url.includes("?") ? "&" : "?"}editToken=${encodeURIComponent(editToken)}`;

  let res: Response;
  try {
    res = await fetch(url, finalInit);
  } catch (cause) {
    throw new ApiError("Network request failed.", 0, undefined, cause);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: ApiResponse<T> | undefined;
  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : undefined;
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
  getSongs: (category?: "wip" | "official") =>
    request<Song[]>(`/api/songs${category ? `?category=${category}` : ""}`),
  getSong: (songId: number) => request<Song>(`/api/songs/${songId}`),
  getComments: (songId: number) => request<Comment[]>(`/api/songs/${songId}/comments`),
  postComment: (songId: number, body: { author: string; content: string }) =>
    request<Comment>(`/api/songs/${songId}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postRating: (songId: number, body: { stars: number; visitorId: string }) =>
    request<Rating>(`/api/songs/${songId}/ratings`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getMyRating: (songId: number, visitorId: string) =>
    request<number | null>(`/api/songs/${songId}/ratings/mine?visitorId=${encodeURIComponent(visitorId)}`),

  getSoundCloudAlbums: () => request<SoundCloudAlbum[]>("/api/albums/soundcloud"),

  // --- Admin / admin client ---
  uploadSong: (form: FormData, adminKey: string) =>
    request<Song>("/api/songs", { method: "POST", body: form, adminKey }),
  replaceSongAudio: (songId: number, form: FormData, adminKey: string) =>
    request<Song>(`/api/songs/${songId}/audio`, { method: "PUT", body: form, adminKey }),
  deleteSong: (songId: number, adminKey: string) =>
    request<void>(`/api/songs/${songId}`, { method: "DELETE", adminKey }),

  updateComment: (commentId: number, content: string, opts?: { adminKey?: string; editToken?: string }) =>
    request<Comment>(`/api/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
      adminKey: opts?.adminKey,
      editToken: opts?.editToken,
    }),
  deleteComment: (commentId: number, adminKey: string) =>
    request<void>(`/api/comments/${commentId}`, { method: "DELETE", adminKey }),
};
