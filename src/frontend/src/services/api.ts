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

/**
 * Turns a response into its payload or throws the matching `ApiError`.
 *
 * Shared by `request` and `upload` so both transports report failures
 * identically. `fetch` cannot observe upload progress, which is the only reason
 * the multipart path exists.
 */
function unwrap<T>(status: number, text: string, errorIdHeader: string | null): T {
  let payload: ApiEnvelope<T> | undefined;
  try {
    payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : undefined;
  } catch {
    payload = undefined;
  }

  if (status < 200 || status >= 300) {
    const errorId = payload?.meta?.errorId ?? errorIdHeader ?? undefined;
    throw new ApiError(
      payload?.message || `Request failed: ${status}`,
      status,
      errorId,
      payload?.errors
    );
  }
  return payload?.data as T;
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
  return unwrap<T>(res.status, await res.text(), res.headers.get("X-Error-Id"));
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
        if (xhr.status === 204) {
          resolve(undefined as T);
          return;
        }
        try {
          resolve(unwrap<T>(xhr.status, xhr.responseText, xhr.getResponseHeader("X-Error-Id")));
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
