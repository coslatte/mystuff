import { ApiError } from "./api";

// Only 5xx lands here. userMessage prefers the backend's own message for every
// 4xx, and the backend always sends one.
const STATUS_MESSAGES: Record<number, string> = {
  500: "Something went wrong on our side. Try again in a few minutes.",
  502: "Audio storage is unreachable right now. Try again in a few minutes.",
  503: "The service is under maintenance. Try again later.",
  504: "The server took too long to respond. Try again.",
};

export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status > 0 && error.status < 500 && error.message) {
      return error.message;
    }
    return STATUS_MESSAGES[error.status] ?? "Something went wrong. Try again.";
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
  return true;
}
