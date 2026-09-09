const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getSongs: () => request<import("@/types").Song[]>("/api/songs"),
  getComments: (songId: number) => request<import("@/types").Comment[]>(`/api/songs/${songId}/comments`),
  postComment: (songId: number, body: { author: string; content: string }) =>
    request<import("@/types").Comment>(`/api/songs/${songId}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postRating: (songId: number, body: { stars: number }) =>
    request<import("@/types").Rating>(`/api/songs/${songId}/ratings`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
