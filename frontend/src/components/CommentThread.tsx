import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
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
function readEditTokens(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EDIT_TOKENS_STORAGE);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // corrupted storage: ignore and start fresh
  }
  return {};
}

function writeEditTokens(tokens: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDIT_TOKENS_STORAGE, JSON.stringify(tokens));
  } catch {
    // storage full or unavailable: editing still works for this session
  }
}

function rememberEditToken(commentId: number, editToken?: string) {
  if (!editToken) return;
  writeEditTokens({ ...readEditTokens(), [commentId]: editToken });
}

function withLocalEditTokens(comments: Comment[]): Comment[] {
  const tokens = readEditTokens();
  const merged = comments.map((c) =>
    tokens[c.id] != null ? { ...c, editToken: tokens[c.id] } : c
  );
  // prune tokens for comments that are gone so the map stays small
  const alive: Record<string, string> = {};
  for (const c of merged) {
    if (c.editToken) alive[c.id] = c.editToken;
  }
  writeEditTokens(alive);
  return merged;
}

export default function CommentThread({ songId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(AUTHOR_STORAGE) : null;
    if (saved) setAuthor(saved);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setComments(withLocalEditTokens(await api.getComments(songId)));
    } catch (e) {
      setError(e);
    }
  }, [songId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
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
    setError(null);

    try {
      if (typeof window !== "undefined") window.localStorage.setItem(AUTHOR_STORAGE, trimmedAuthor);
      const created = await api.postComment(songId, { author: trimmedAuthor, content: trimmedContent });
      // the server only hands the edit token to the creator: persist it locally
      rememberEditToken(created.id, created.editToken);
      // reconcile with the server response
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? created : c)));
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setContent(trimmedContent);
      setError(err);
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
    // optimistic update
    setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, content: nextContent } : c)));
    setEditingId(null);
    setError(null);

    try {
      const updated = await api.updateComment(comment.id, nextContent, { editToken: comment.editToken });
      // the update response carries no token: keep the locally held one
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...updated, editToken: comment.editToken } : c))
      );
    } catch (err) {
      setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, content: previous } : c)));
      setError(err);
    }
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
          className="border-2 border-black bg-white px-2 py-1 font-mono text-xs outline-none focus:bg-brut-yellow"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="leave comment"
          required
          rows={2}
          className="border-2 border-black bg-white px-2 py-1 font-mono text-xs outline-none focus:bg-brut-yellow"
        />
        <button
          type="submit"
          className="brut-btn self-start !px-3 !py-1 font-mono text-xs"
        >
          publish
        </button>
      </form>

      {error != null && <ErrorNotice error={error} className="mt-2" />}
    </div>
  );
}
