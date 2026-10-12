import { ApiError } from "./api";

// Only 5xx lands here. userMessage prefers the backend's own message for every
// 4xx, and the backend always sends one.
const STATUS_MESSAGES: Record<number, string> = {
  500: "Something went wrong on our side. Try again in a few minutes.",
  502: "Audio storage is unreachable right now. Try again in a few minutes.",
  503: "The service is under maintenance. Try again later.",
  504: "The server took too long to respond. Try again.",
};

/**
 * Client-side failures are raised as plain `Error`s (validation, storage, abort)
 * and only reach the server through `ApiError`. Falling through to the network
 * message for them made "select an audio file" read as "we couldn't reach the
 * server", which is both wrong and unactionable.
 */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status > 0 && error.status < 500 && error.message) {
      return error.message;
    }
    return STATUS_MESSAGES[error.status] ?? "Something went wrong. Try again.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

export function errorReference(error: unknown): string | null {
  if (error instanceof ApiError && error.errorId) {
    return `#${error.errorId}`;
  }
  return null;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
  }
  // A plain Error was raised locally (validation, storage). Repeating the
  // request cannot change the outcome, so offering retry would be a dead end.
  return false;
}
