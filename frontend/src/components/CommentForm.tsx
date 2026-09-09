import { useState } from "react";
import { api } from "../services/api";

type Props = {
  songId: number;
  onCreated?: () => void;
};

export default function CommentForm({ songId, onCreated }: Props) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.postComment(songId, { author, content });
      setContent("");
      onCreated?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-2">
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="your name"
        required
        className="border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="leave your opinion"
        required
        rows={3}
        className="border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="brut-btn bg-brut-yellow font-mono text-sm disabled:opacity-50"
      >
        {loading ? "sending..." : "publish comment"}
      </button>
    </form>
  );
}
