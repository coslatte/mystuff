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
export default function Forum({ editor = false }: { editor?: boolean }) {
  const t = useTranslations();
  const m = messages.forum;
  const [adminKey, setAdminKey] = useState("");
  const [keySubmitted, setKeySubmitted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [notes, setNotes] = useState<ForumNote[]>([]);
  const [publishedHtml, setPublishedHtml] = useState<Record<number, string>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<NoteInput>({ title: "", author: "Gabriel Paz", content: "", status: "DRAFT" });
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const authenticated = editor && authorized;

  useEffect(() => {
    const saved = readText(ADMIN_KEY_STORAGE);
    if (saved && editor) {
      setAdminKey(saved);
      setKeySubmitted(true);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor || !keySubmitted || !adminKey) return;
    const controller = new AbortController();
    api.getForumNotes(adminKey, controller.signal).then((result) => {
      setNotes(result);
      setAuthorized(true);
      setError(null);
      writeText(ADMIN_KEY_STORAGE, adminKey);
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setAuthorized(false);
        setKeySubmitted(false);
        setError(cause);
      }
    });
    return () => controller.abort();
  }, [adminKey, editor, keySubmitted]);

  useEffect(() => {
    if (editor) return;
    const controller = new AbortController();
    api.getPublishedForumNotes(controller.signal).then(setNotes).catch((cause) => {
      if (!controller.signal.aborted) setError(cause);
    });
    return () => controller.abort();
  }, [editor]);

  useEffect(() => {
    let active = true;
    if (!editor) return () => { active = false; };
    renderMarkdown(form.content).then((html) => { if (active) { setPreviewHtml(html); setPreviewError(null); } }).catch((cause) => { if (active) setPreviewError(cause); });
    return () => { active = false; };
  }, [editor, form.content]);

  useEffect(() => {
    if (editor || notes.length === 0) return;
    let active = true;
    Promise.all(notes.map(async (note) => [note.id, await renderMarkdown(note.content)] as const))
      .then((entries) => { if (active) setPublishedHtml(Object.fromEntries(entries)); })
      .catch((cause) => { if (active) setError(cause); });
    return () => { active = false; };
  }, [editor, notes]);

  const selected = useMemo(() => notes.find((note) => note.id === selectedId), [notes, selectedId]);
  const setKey = (value: string) => {
    setAdminKey(value);
    setKeySubmitted(false);
    setAuthorized(false);
    setError(null);
  };
  const lockEditor = () => {
    removeKey(ADMIN_KEY_STORAGE);
    setAdminKey("");
    setKeySubmitted(false);
    setAuthorized(false);
    setNotes([]);
    setSelectedId(null);
    setError(null);
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

  if (!editor) return <div className="flex flex-col gap-6">
    {error != null && <ErrorNotice error={error} />}
    {notes.length === 0 && error == null && <p className="font-mono text-sm text-brut-muted">{t(m.noPublishedNotes)}</p>}
    <section className="flex flex-col gap-5">{notes.map((note) => <article key={note.id} className="brut-panel p-5 sm:p-8">
      <header className="mb-5 border-b-2 border-brut-black pb-4">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{note.title}</h2>
        <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-xs text-brut-muted"><span>{note.author}</span><span>·</span><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleDateString()}</time></p>
      </header>
      {publishedHtml[note.id] ? <div className="forum-markdown" dangerouslySetInnerHTML={{ __html: publishedHtml[note.id] }} /> : <p className="font-mono text-sm">{note.content}</p>}
    </article>)}</section>
    <div className="text-right"><a href="/forum/admin" className="font-mono text-xs text-brut-muted underline">{t(m.adminLink)}</a></div>
  </div>;

  return <div className="flex flex-col gap-6">
    <section className="brut-panel p-5">
      {!authenticated ? <form onSubmit={(event) => { event.preventDefault(); setKeySubmitted(true); }}>
        <label className="brut-label block">{t(m.adminKey)}
          <input type="password" value={adminKey} onChange={(event) => setKey(event.target.value)} placeholder="X-Admin-Key" autoComplete="current-password" className="brut-field-quiet mt-1 w-full px-3 py-2 text-sm" />
        </label>
        <p className="brut-meta mt-3 text-brut-muted">{t(m.privateNotice)}</p>
        <button type="submit" disabled={!adminKey || keySubmitted} className="mt-4 border-2 border-brut-black bg-brut-blue px-4 py-2 font-mono text-sm text-brut-on-accent disabled:opacity-50">{t(m.unlock)}</button>
      </form> : <div className="flex items-center justify-between gap-4"><span className="font-mono text-sm">{t(m.title)} · {t(m.adminKey)}</span><button type="button" onClick={lockEditor} className="border-2 border-brut-black bg-brut-subtle px-3 py-2 font-mono text-xs">{t(m.logout)}</button></div>}
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
