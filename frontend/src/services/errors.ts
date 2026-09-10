import { ApiError } from "./api";

const STATUS_MESSAGES: Record<number, string> = {
  400: "The request was invalid. Check your input and try again.",
  401: "Your session expired. Please sign in again.",
  403: "You don't have permission to do this.",
  404: "We couldn't find what you were looking for.",
  405: "That action isn't allowed here.",
  408: "The request timed out. Please try again.",
  409: "There was a conflict. Reload the page and try again.",
  413: "The file is too large to upload.",
  415: "That file type isn't supported.",
  422: "Some fields are invalid. Review them and try again.",
  429: "Too many requests. Wait a moment and try again.",
  500: "Something went wrong on our side. Please try again in a few minutes.",
  502: "The service is unavailable right now. Please try again in a few minutes.",
  503: "The service is under maintenance. Please try again later.",
  504: "The server took too long to respond. Please try again.",
};

export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Backend messages for 4xx are safe and domain-specific; 5xx stay generic.
    if (error.status > 0 && error.status < 500 && error.message) {
      return error.message;
    }
    return STATUS_MESSAGES[error.status] ?? "Something went wrong. Please try again.";
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
