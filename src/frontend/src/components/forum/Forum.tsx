import { useEffect, useMemo, useState } from "react";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import katex from "katex";
import "katex/dist/katex.min.css";
import { api } from "../../services/api";
import { readText, removeKey, writeText } from "../../services/storage";
import { useTranslations } from "../../hooks/useTranslations";
import { messages } from "../../lib/i18n/catalog";
import type { ForumNote } from "../../types";
import ErrorNotice from "../shared/ErrorNotice";

const ADMIN_KEY_STORAGE = "clm_admin_key";
type NoteInput = Pick<ForumNote, "title" | "author" | "content" | "status">;

async function renderMarkdown(source: string) {
  const expressions: string[] = [];
  const escaped = source.replace(/\$\$([\s\S]+?)\$\$|\$([^\n$]+)\$/g, (_, display: string | undefined, inline: string | undefined) => {
    expressions.push(katex.renderToString(display ?? inline ?? "", { displayMode: Boolean(display), throwOnError: false, trust: false }));
    return `FORUMMATHPLACEHOLDER${expressions.length - 1}END`;
  });
  const processor = await createMarkdownProcessor({ shikiConfig: { theme: "github-dark" }, gfm: true });
  const { code } = await processor.render(escaped);
  return code.replace(/FORUMMATHPLACEHOLDER(\d+)END/g, (_, index: string) => expressions[Number(index)])
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
}
export default function Forum() {
  const t = useTranslations();
  const m = messages.forum;
  const [adminKey, setAdminKey] = useState("");
  const [notes, setNotes] = useState<ForumNote[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<NoteInput>({ title: "", author: "Gabriel Paz", content: "", status: "DRAFT" });
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const authenticated = adminKey.length > 0;

  useEffect(() => {
    const saved = readText(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    api.getForumNotes(adminKey, controller.signal).then(setNotes).catch((cause) => {
      if (!controller.signal.aborted) setError(cause);
    });
    return () => controller.abort();
  }, [adminKey, authenticated]);

  useEffect(() => {
    let active = true;
    renderMarkdown(form.content).then((html) => { if (active) { setPreviewHtml(html); setPreviewError(null); } }).catch((cause) => { if (active) setPreviewError(cause); });
    return () => { active = false; };
  }, [form.content]);

  const selected = useMemo(() => notes.find((note) => note.id === selectedId), [notes, selectedId]);
  const setKey = (value: string) => {
    setAdminKey(value);
    setError(null);
    if (value) writeText(ADMIN_KEY_STORAGE, value);
    else {
      removeKey(ADMIN_KEY_STORAGE);
      setNotes([]);
      setSelectedId(null);
    }
  };
  const selectNote = (note: ForumNote) => {
    setSelectedId(note.id);
    setForm({ title: note.title, author: note.author, content: note.content, status: note.status });
    setPreview(false);
  };
  const newNote = () => {
    setSelectedId(null);
    setForm({ title: "", author: "Gabriel Paz", content: "", status: "DRAFT" });
    setPreview(false);
  };
  const save = async (status: ForumNote["status"]) => {
    setError(null);
    setNotice("");
    setBusy(true);
    const body = { ...form, title: form.title.trim() || t(m.untitled), status };
    try {
      const saved = selectedId ? await api.updateForumNote(selectedId, body, adminKey) : await api.createForumNote(body, adminKey);
      setNotes((previous) => [saved, ...previous.filter((note) => note.id !== saved.id)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      setSelectedId(saved.id);
      setForm({ title: saved.title, author: saved.author, content: saved.content, status: saved.status });
      setNotice(t(m.saved));
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  const deleteNote = async () => {
    if (!selectedId || !confirm(`${t(m.delete)} “${form.title}”?`)) return;
    setBusy(true);
    try {
      await api.deleteForumNote(selectedId, adminKey);
      setNotes((previous) => previous.filter((note) => note.id !== selectedId));
      newNote();
      setNotice(t(m.deleted));
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };

  return <div className="flex flex-col gap-6">
    <section className="brut-panel p-5">
      <label className="brut-label block">{t(m.adminKey)}
        <input type="password" value={adminKey} onChange={(event) => setKey(event.target.value)} placeholder="X-Admin-Key" autoComplete="current-password" className="brut-field-quiet mt-1 w-full px-3 py-2 text-sm" />
      </label>
      {!authenticated && <p className="brut-meta mt-3 text-brut-muted">{t(m.privateNotice)}</p>}
      {error != null && <ErrorNotice error={error} className="mt-4" />}
      {notice && <p role="status" className="mt-4 font-mono text-sm">{notice}</p>}
    </section>
    {authenticated && <div className="grid gap-6 laptop:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.5fr)]">
      <aside className="border-2 border-brut-black bg-brut-subtle p-4">
        <div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-display font-bold">{t(m.title)} <span className="font-mono text-xs">({notes.length})</span></h2><button type="button" onClick={newNote} className="border-2 border-brut-black bg-brut-surface px-3 py-2 font-mono text-xs">+ {t(m.newNote)}</button></div>
        {notes.length === 0 && <p className="font-mono text-sm text-brut-muted">{t(m.empty)}</p>}
        <ul className="flex flex-col gap-2">{notes.map((note) => <li key={note.id}><button type="button" onClick={() => selectNote(note)} aria-current={note.id === selectedId ? "true" : undefined} className="w-full border-2 border-brut-black bg-brut-surface p-3 text-left aria-[current=true]:bg-brut-blue aria-[current=true]:text-brut-on-accent"><span className="block font-display font-bold">{note.title}</span><span className="mt-1 flex justify-between gap-2 font-mono text-[10px]"><span>{note.status === "DRAFT" ? t(m.draft) : t(m.published)}</span><time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleDateString()}</time></span></button></li>)}</ul>
      </aside>
      <section className="brut-panel min-w-0 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display font-bold">{selected ? t(m.edit) : t(m.newNote)}</h2><div className="flex gap-2"><button type="button" onClick={() => setPreview((value) => !value)} className="border-2 border-brut-black bg-brut-subtle px-3 py-2 font-mono text-xs">{preview ? t(m.edit) : t(m.preview)}</button>{selected && <button type="button" disabled={busy} onClick={deleteNote} className="border-2 border-brut-black px-3 py-2 font-mono text-xs hover:bg-brut-red hover:text-brut-on-accent disabled:opacity-50">{t(m.delete)}</button>}</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="brut-label">{t(m.titleLabel)}<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} className="brut-field-quiet mt-1 w-full px-3 py-2" /></label><label className="brut-label">{t(m.authorLabel)}<input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} maxLength={100} className="brut-field-quiet mt-1 w-full px-3 py-2" /></label></div>
        {preview ? <div className="forum-markdown mt-4 min-h-64 border-2 border-brut-black bg-brut-surface p-5">{previewError ? <ErrorNotice error={previewError} /> : <div dangerouslySetInnerHTML={{ __html: previewHtml }} />}</div> : <label className="brut-label mt-4 block">{t(m.contentLabel)}<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={18} maxLength={200000} className="brut-field-quiet mt-1 w-full resize-y px-3 py-2 font-mono text-sm" /></label>}
        <p className="brut-meta mt-2 text-brut-muted">{t(m.mathHint)}</p>
        {selected && <p className="brut-meta mt-2 text-brut-muted">{t(m.created)}: {new Date(selected.createdAt).toLocaleString()} · {t(m.updated)}: {new Date(selected.updatedAt).toLocaleString()}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy || !form.author.trim() || !form.content.trim()} onClick={() => save("DRAFT")} className="border-2 border-brut-black bg-brut-subtle px-4 py-2 font-mono text-sm disabled:opacity-50">{t(m.saveDraft)}</button><button type="button" disabled={busy || !form.author.trim() || !form.content.trim()} onClick={() => save("PUBLISHED")} className="border-2 border-brut-black bg-brut-blue px-4 py-2 font-mono text-sm text-brut-on-accent disabled:opacity-50">{t(m.publish)}</button></div>
      </section>
    </div>}
  </div>;
}
