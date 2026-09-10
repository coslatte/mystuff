---
name: optimistic-ui
description: Apply the optimistic UI pattern for mutations (ratings, comments, edits) so the interface updates instantly instead of reloading, sends the change to the backend in the background, then reconciles with the server response and rolls back on failure. Use when adding or editing ratings, comments or any user-generated data. Triggers on: rating, comment, optimistic, reload, edit.
---

# Optimistic UI updates

Mutations in `cosmiclatteweb` MUST update the interface immediately, then sync
with the backend, then reconcile with the authoritative server response. Never
trigger a full page reload for a rating or a comment.

## Pattern
1. **Apply optimistically**: update local state as if the request succeeded.
2. **Send to backend**: fire the API request in the background (no full reload).
3. **Reconcile**: replace the optimistic value with the server response.
4. **Roll back**: on error, restore the previous state and surface the error.

## Reference implementations
- Rating: `frontend/src/components/MusicSection.tsx` (`handleRate`) — bumps
  `avgRating`/`totalVotes` locally, `POST /ratings`, then refetches the single
  song via `api.getSong` and replaces it.
- Comments (create + edit): `frontend/src/components/CommentThread.tsx` — adds a
  temporary comment with a negative id, posts, then swaps it for the server
  comment; edits swap the content and revert on failure.

## Rules
1. Never call `window.location.reload()` or refetch the whole collection to
   reflect a single mutation.
2. Use a temporary id (e.g. `-Date.now()`) for optimistic creates and map it to
   the server id on reconcile.
3. Keep the previous value around to roll back on error.
4. Surface failures with `ErrorNotice`; do not fail silently.
5. Only comments created by the visitor can be edited, and only within the
   5 minute window enforced by the backend (`CommentService.EDIT_WINDOW`).
6. The `editToken` returned by the API is required to edit a comment; only show
   the edit action when the token is present and the window is open.

## Backend contract
- `CommentResponse` includes `editToken`, `createdAt` and `updatedAt`.
- `CommentService.update` rejects edits past the 5 minute window with HTTP 403.
