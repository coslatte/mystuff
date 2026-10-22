import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../services/api";
import { useTranslations } from "../../hooks/useTranslations";
import { messages } from "../../lib/i18n/catalog";
import ErrorNotice from "../shared/ErrorNotice";

type Props = { songId: number; adminKey: string; disabled?: boolean };

export default function TrackShareControls({ songId, adminKey, disabled = false }: Props) {
  const t = useTranslations();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const statusRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    statusRequest.current = controller;
    setUrl("");
    setCopied(false);
    setError(null);
    // Key entry updates on every keystroke; wait before querying each song.
    const timer = window.setTimeout(() => {
      if (!adminKey) return;
      api.getSongShare(songId, adminKey, controller.signal).then(shared => {
        if (!controller.signal.aborted) setUrl(`${window.location.origin}/share?token=${encodeURIComponent(shared.token)}`);
      }).catch(reason => {
        if (!controller.signal.aborted && !(reason instanceof ApiError && [403, 404].includes(reason.status))) setError(reason);
      });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [songId, adminKey]);

  const copy = async (value: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch (reason) {
      setError(reason);
    }
  };

  const changeShare = async (enable: boolean) => {
    if (busy.current) return;
    busy.current = true;
    statusRequest.current?.abort();
    setPending(true);
    setCopied(false);
    setError(null);
    try {
      if (enable) {
        const shared = await api.createSharedTrack(songId, adminKey);
        const value = `${window.location.origin}/share?token=${encodeURIComponent(shared.token)}`;
        setUrl(value);
        await copy(value);
      } else {
        await api.revokeSharedTrack(songId, adminKey);
        setUrl("");
      }
    } catch (reason) {
      setError(reason);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const locked = disabled || pending || !adminKey;
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2" data-track-share>
      <button type="button" disabled={locked} aria-busy={pending} onClick={() => void changeShare(true)}
        className="brut-btn !px-2 !py-1 font-mono text-xs disabled:opacity-50">
        {t(messages.music.shareTrack)}{pending && "…"}
      </button>
      {url && <>
        <input readOnly value={url} onFocus={event => event.currentTarget.select()} aria-label={t(messages.music.copyShareLink)}
          className="min-w-0 flex-1 border-2 border-brut-black bg-brut-surface px-2 py-1 font-mono text-xs" />
        <button type="button" onClick={() => void copy(url)} className="brut-btn !px-2 !py-1 font-mono text-xs">
          {copied ? t(messages.music.shareLinkCopied) : t(messages.music.copyShareLink)}
        </button>
        <button type="button" disabled={locked} onClick={() => void changeShare(false)} className="brut-btn !px-2 !py-1 font-mono text-xs">
          {t(messages.music.disableShare)}
        </button>
      </>}
      {error != null && <ErrorNotice error={error} className="w-full" />}
    </div>
  );
}
