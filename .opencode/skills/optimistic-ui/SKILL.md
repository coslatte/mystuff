---
name: optimistic-ui
description: Apply the optimistic UI pattern for mutations (ratings, comments, edits) so the interface updates instantly instead of reloading, sends the change to the backend in the background, then reconciles with the server response and rolls back on failure. Use when adding or editing ratings, comments or any user-generated data. Triggers on: rating, comment, optimistic, reload, edit.
---

# Optimistic UI updates

A rating or a comment must never trigger a full page reload. Update the
interface first, send the request, then reconcile with what the server says.

## Pattern

1. Apply the change to local state as if the request succeeded.
2. Fire the request without reloading the page.
3. Replace the optimistic value with the server response.
4. On failure, restore the previous value and surface the error.

## Reference implementations

Ratings live in `src/frontend/src/components/music/MusicSection.tsx` (`handleRate`), which
bumps `avgRating`/`totalVotes` locally, posts, then refetches the single song via
`api.getSong` and replaces it.

Comments (create and edit) live in `src/frontend/src/components/music/CommentThread.tsx`.
It inserts a comment with a negative id, posts, then swaps in the server comment.
Edits swap the content and revert on failure.

## Rules

Never call `window.location.reload()` or refetch the whole collection to reflect
one mutation.

Give optimistic creates a temporary id, `-Date.now()` for comments, and map it to
the server id on reconcile. Keep the previous value so it can be rolled back.

Report failures with `ErrorNotice`. Do not fail silently.

A visitor can only edit comments they created, and only within five minutes.
`CommentService.EDIT_WINDOW` enforces the window. The `editToken` returned by
the API is required to edit, so only show the edit action when the token is
present and the window is still open. Send it as the `X-Edit-Token` header, not
in the query string.

## Backend contract

`CreatedCommentResponse` carries the `editToken`. `CommentResponse`, which the
public listing uses, deliberately does not.

`CommentService.update` rejects edits past the five minute window with HTTP 403.