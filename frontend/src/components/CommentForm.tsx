import { useState } from "react";
import { api } from "../services/api";

export default function CommentForm({ songId, onCreated }: { songId: number; onCreated?: () => void }) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.postComment(songId, { author, content });
      setAuthor("");
      setContent("");
      onCreated?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Tu nombre"
        required
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Deja un comentario"
        required
        rows={3}
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
      />
      <button
        disabled={loading}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
      >
        {loading ? "Enviando..." : "Comentar"}
      </button>
    </form>
  );
}
