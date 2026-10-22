import { PUBLIC_API_URL } from "astro:env/client";
import type {
  Comment,
  ClientErrorReport,
  CreatedComment,
  Health,
  Rating,
  SharedTrack,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrap(status: number, text: string, errorIdHeader: string | null): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  const payload = isRecord(parsed) ? parsed : undefined;
  const meta = isRecord(payload?.meta) ? payload.meta : undefined;
  const errorId = typeof meta?.errorId === "string" ? meta.errorId : errorIdHeader ?? undefined;
  if (status < 200 || status >= 300) {
    throw new ApiError(
      typeof payload?.message === "string" && payload.message ? payload.message : `Request failed: ${status}`,
      status,
      errorId,
      payload?.errors
    );
  }
  if (!payload || payload.success !== true || !("data" in payload)) {
    throw new ApiError("Invalid server response.", status, errorId);
  }
  return payload.data;
}

function requireData<T>(status: number, text: string, errorId: string | null): T {
  const data = unwrap(status, text, errorId);
  if (data === null || data === undefined) {
    throw new ApiError("The server response is missing its data.", status, errorId ?? undefined);
  }
  // DTO fields follow the generated OpenAPI contract; the transport validates the envelope.
  return data as T;
}

type RequestOptions = RequestInit & { adminKey?: string; editToken?: string };

function request(path: string, init: RequestOptions & { response: "empty" }): Promise<void>;
function request<T>(path: string, init?: RequestOptions): Promise<T>;
async function request<T>(
  path: string,
  init?: RequestOptions & { response?: "empty" }
): Promise<T | void> {
  const { adminKey, editToken, headers, body, response, ...rest } = init ?? {};
  const finalHeaders = new Headers(headers);
  if (adminKey) finalHeaders.set("X-Admin-Key", adminKey);
  // The edit token is a bearer secret, so it travels in a header instead of the
  // query string where it would land in access logs and Referer headers.
  if (editToken) finalHeaders.set("X-Edit-Token", editToken);
  if (body && !(body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
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

  if (response === "empty") {
    if (res.status !== 204) unwrap(res.status, await res.text(), res.headers.get("X-Error-Id"));
    return;
  }
  return requireData<T>(res.status, await res.text(), res.headers.get("X-Error-Id"));
}

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0-100, or null while the browser cannot measure the body length. */
  percent: number | null;
};

/**
 * Multipart upload over XMLHttpRequest.
 *
 * `fetch` exposes no request-progress events, so an upload of up to 20 MB had no
 * progress at all and looked frozen on a slow connection. XHR is the only way to
 * report bytes sent, which is what the queue renders.
 */
function upload<T>(
  path: string,
  method: "POST" | "PUT",
  form: FormData,
  adminKey: string,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, rejectPromise) => {
    if (signal?.aborted) {
      rejectPromise(new ApiError("Upload cancelled.", 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_URL}${path}`);
    xhr.setRequestHeader("X-Admin-Key", adminKey);

    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });

    const finish = (settle: () => void) => {
      signal?.removeEventListener("abort", abort);
      settle();
    };

    xhr.upload.onprogress = (event) => {
      // lengthComputable is false when the body is a stream of unknown size;
      // reporting a fake percentage there would be worse than showing a spinner.
      const percent = event.lengthComputable && event.total > 0
        ? Math.round((event.loaded / event.total) * 100)
        : null;
      onProgress?.({ loaded: event.loaded, total: event.total, percent });
    };

    xhr.onload = () => {
      finish(() => {
        try {
          resolve(requireData<T>(xhr.status, xhr.responseText, xhr.getResponseHeader("X-Error-Id")));
        } catch (err) {
          rejectPromise(err);
        }
      });
    };

    xhr.onerror = () =>
      finish(() => rejectPromise(new ApiError("Network request failed.", 0)));
    xhr.onabort = () =>
      finish(() => rejectPromise(new ApiError("Upload cancelled.", 0)));
    xhr.ontimeout = () =>
      finish(() => rejectPromise(new ApiError("The upload timed out.", 0)));

    xhr.send(form);
  });
}

export const api = {
  submitContactMessage: async (body: { submissionId: string; name: string; email: string; message: string; website: string }, signal?: AbortSignal) => {
    const receipt = await request<unknown>("/api/contact/messages", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    if (typeof receipt !== "object" || receipt === null
      || !("messageId" in receipt) || typeof receipt.messageId !== "string" || !receipt.messageId.trim()
      || !("status" in receipt) || receipt.status !== "accepted") {
      throw new Error("Invalid contact receipt.");
    }
    return { messageId: receipt.messageId, status: receipt.status };
  },
  health: () => request<Health>("/health"),
  getSongs: (visitorId?: string, signal?: AbortSignal) =>
    request<Song[]>(`/api/songs${visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ""}`, { signal }),
  getSong: (songId: number) => request<Song>(`/api/songs/${songId}`),
  createSharedTrack: (songId: number, adminKey: string) =>
    request<SharedTrack>(`/api/songs/${songId}/share`, { method: "POST", adminKey }),
  getSongShare: (songId: number, adminKey: string, signal?: AbortSignal) =>
    request<SharedTrack>(`/api/songs/${songId}/share`, { adminKey, signal, cache: "no-store" }),
  getSharedTrack: (token: string, visitorId?: string, signal?: AbortSignal) =>
    request<SharedTrack>(`/api/shared-tracks/${encodeURIComponent(token)}${visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ""}`, { signal, cache: "no-store" }),
  revokeSharedTrack: (songId: number, adminKey: string) =>
    request(`/api/songs/${songId}/share`, { method: "DELETE", adminKey, response: "empty" }),
  getComments: (songId: number, signal?: AbortSignal) => request<Comment[]>(`/api/songs/${songId}/comments`, { signal }),
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

  getSoundCloudAlbums: (signal?: AbortSignal) => request<SoundCloudAlbum[]>("/api/albums/soundcloud", { signal }),
  reportClientError: (body: ClientErrorReport) => request("/api/client-errors", {
    method: "POST",
    body: JSON.stringify(body),
    response: "empty",
  }),

  uploadSong: (
    form: FormData,
    adminKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ) => upload<Song>("/api/songs", "POST", form, adminKey, onProgress, signal),

  replaceSongAudio: (
    songId: number,
    form: FormData,
    adminKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ) =>
    upload<Song>(`/api/songs/${songId}/audio`, "PUT", form, adminKey, onProgress, signal),

  deleteSong: (songId: number, adminKey: string) =>
    request(`/api/songs/${songId}`, { method: "DELETE", adminKey, response: "empty" }),

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
