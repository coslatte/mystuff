import type { Comment, Rating, Song, SoundCloudAlbum } from "../types";

const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8080";

type ApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data?: T;
  errors?: unknown;
};

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

  const res = await fetch(url, finalInit);
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: ApiResponse<T> | undefined;
  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : undefined;
  } catch {
    payload = undefined;
  }

  if (!res.ok) {
    throw new Error(payload?.message || text || `Request failed: ${res.status}`);
  }
  return payload?.data as T;
}

export const api = {
  getSongs: () => request<Song[]>("/api/songs"),
  getComments: (songId: number) => request<Comment[]>(`/api/songs/${songId}/comments`),
  postComment: (songId: number, body: { author: string; content: string }) =>
    request<Comment>(`/api/songs/${songId}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postRating: (songId: number, body: { stars: number }) =>
    request<Rating>(`/api/songs/${songId}/ratings`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

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
