import { useEffect, useState } from "react";
import { api } from "../services/api";
import { runOptimistic } from "../lib/optimistic";
import { readJson, readText, writeJson, writeText } from "../lib/storage";
import { useResource } from "../hooks/useResource";
import type { Comment } from "../types";
import ErrorNotice from "./ErrorNotice";

type Props = {
  songId: number;
};

const AUTHOR_STORAGE = "clm_author";
const EDIT_TOKENS_STORAGE = "clm_edit_tokens";
const EDIT_WINDOW_MS = 5 * 60 * 1000;

function canEdit(comment: Comment) {
  if (!comment.editToken || comment.id < 0) return false;
  const created = new Date(comment.createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created <= EDIT_WINDOW_MS;
}

// Edit tokens are bearer secrets: they live only in the creator's browser,
// never in the public listing. This keeps edit rights across reloads.
type EditTokens = Record<string, string>;

function readEditTokens(): EditTokens {
  return readJson<EditTokens>(EDIT_TOKENS_STORAGE, {});
}

function rememberEditToken(commentId: number, editToken?: string) {
  if (!editToken) return;
  writeJson(EDIT_TOKENS_STORAGE, { ...readEditTokens(), [commentId]: editToken });
}

function withLocalEditTokens(comments: Comment[]): Comment[] {
  const tokens = readEditTokens();
  const merged = comments.map((c) =>
    tokens[c.id] != null ? { ...c, editToken: tokens[c.id] } : c
  );
  // prune tokens for comments that are gone so the map stays small
  const alive: EditTokens = {};
  for (const c of merged) {
    if (c.editToken) alive[c.id] = c.editToken;
  }
  writeJson(EDIT_TOKENS_STORAGE, alive);
  return merged;
}

export default function CommentThread({ songId }: Props) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const {
    data,
    error: loadError,
    setData: setComments,
    reload,
  } = useResource<Comment[]>(
    async () => withLocalEditTokens(await api.getComments(songId)),
    [songId]
  );
  const comments = data ?? [];

  useEffect(() => {
    const saved = readText(AUTHOR_STORAGE);
    if (saved) setAuthor(saved);
  }, []);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedAuthor = author.trim();
    const trimmedContent = content.trim();
    if (!trimmedAuthor || !trimmedContent) return;

    const optimistic: Comment = {
      id: -Date.now(),
      songId,
      author: trimmedAuthor,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
    };
    // optimistic insert
    setComments((prev) => [...prev, optimistic]);
    setContent("");
    setMutationError(null);

    try {
      writeText(AUTHOR_STORAGE, trimmedAuthor);
      const created = await api.postComment(songId, { author: trimmedAuthor, content: trimmedContent });
      // Only the creator receives the edit token, so persist it locally.
      rememberEditToken(created.id, created.editToken);
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? created : c)));
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setContent(trimmedContent);
      setMutationError(err);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }

  async function saveEdit(comment: Comment) {
    const nextContent = editContent.trim();
    if (!nextContent || nextContent === comment.content) {
      setEditingId(null);
      return;
    }
    const previous = comment.content;
    setEditingId(null);

    await runOptimistic({
      apply: () =>
        setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, content: nextContent } : c))),
      async commit() {
        const updated = await api.updateComment(comment.id, nextContent, { editToken: comment.editToken });
        // The update response carries no token, so keep the one held locally.
        setComments((prev) =>
          prev.map((c) => (c.id === comment.id ? { ...updated, editToken: comment.editToken } : c))
        );
      },
      rollback: () =>
        setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, content: previous } : c))),
      onError: setMutationError,
    });
  }

  return (
    <div className="mt-2 border-t-2 border-black pt-2">
      <ul className="flex flex-col">
        {comments.map((comment) => (
          <li key={comment.id} className="border-b border-neutral-300 py-1.5 pl-4 last:border-b-0">
            <p className="font-mono text-[11px] font-bold">
              {comment.author}
              {comment.updatedAt && <span className="ml-2 text-gray-400">(edited)</span>}
            </p>
            {editingId === comment.id ? (
              <div className="mt-1 flex flex-col gap-1">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                  className="border-2 border-black bg-white px-2 py-1 font-mono text-xs outline-none"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => saveEdit(comment)}
                    className="border-2 border-black bg-brut-yellow px-2 py-0.5 font-mono text-[10px] font-bold"
                  >
                    save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="border-2 border-black bg-white px-2 py-0.5 font-mono text-[10px]"
                  >
                    cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-700">
                {comment.content}
                {canEdit(comment) && (
                  <button
                    type="button"
                    onClick={() => startEdit(comment)}
                    className="ml-2 font-mono text-[10px] text-gray-400 underline hover:text-brut-red"
                  >
                    edit
                  </button>
                )}
              </p>
            )}
          </li>
        ))}
        {!comments.length && <li className="py-1 font-mono text-xs text-gray-500">no comments yet.</li>}
      </ul>

      <form onSubmit={submit} className="mt-2 flex flex-col gap-1">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="your name"
          required
          className="brut-field px-2 py-1 text-xs"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="leave comment"
          required
          rows={2}
          className="brut-field px-2 py-1 text-xs"
        />
        <button
          type="submit"
          className="brut-btn self-start !px-3 !py-1 font-mono text-xs"
        >
          publish
        </button>
      </form>

      {loadError != null && (
        <ErrorNotice error={loadError} onRetry={reload} className="mt-2" />
      )}
      {mutationError != null && <ErrorNotice error={mutationError} className="mt-2" />}
    </div>
  );
}
