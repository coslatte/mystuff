import { useTranslations } from "../../hooks/useTranslations";
import { messages } from "../../lib/i18n/catalog";
import type { PlainMessageKey } from "../../lib/i18n/types";
import { Fragment } from "react";
import ServerPulse, { type Stage } from "./ServerPulse";

type Props = {
  serverReady: boolean;
  elapsed: number;
};

type Chunk = {
  text: PlainMessageKey;
  emphasis?: boolean;
};

type Status = {
  chunks: Chunk[];
  stage: Stage;
  detail?: PlainMessageKey;
};

// Plain fragments rather than a substring to highlight, so editing a message can
// never silently drop the emphasis.
function statusFor(serverReady: boolean, elapsed: number): Status {
  if (serverReady) {
    return {
      chunks: [{ text: messages.music.loadingTracks }],
      stage: "ready",
      detail: messages.music.theServerIsReady,
    };
  }
  if (elapsed < 3) {
    return { chunks: [{ text: messages.music.connectingToTheServer }], stage: "connecting" };
  }
  if (elapsed < 10) {
    return {
      chunks: [{ text: messages.music.startingTheServer }],
      stage: "waking",
      detail: messages.music.theFirstRequestMayTakeUpToAMinute,
    };
  }
  if (elapsed < 25) {
    return {
      chunks: [{ text: messages.music.waitingForTheServer }],
      stage: "booting",
      detail: messages.music.tracksWillLoadWhenTheConnectionIsReady,
    };
  }
  return {
    chunks: [{ text: messages.music.waitingForTheServer }],
    stage: "almost",
    detail: messages.music.ifThisContinuesReloadThePage,
  };
}

export default function LoadingTracks({ serverReady, elapsed }: Props) {
  const t = useTranslations();
  const { chunks, stage, detail } = statusFor(serverReady, elapsed);
  const message = chunks.map((chunk) => chunk.text).join("");

  return (
    <div className="border-b-2 border-brut-black bg-brut-surface p-6 tablet:p-8" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <ServerPulse stage={stage} />
        <span key={message} className="text-morph font-mono text-sm font-bold">
          {chunks.map((chunk, i) =>
            chunk.emphasis ? (
              <em key={i} className="italic">
              {t(chunk.text)}
              </em>
            ) : (
              <Fragment key={i}>{t(chunk.text)}</Fragment>
            )
          )}
        </span>
      </div>
      {detail && (
        <p key={detail} className="text-morph mt-2 font-mono text-xs text-brut-muted">
          {t(detail)}
        </p>
      )}
    </div>
  );
}
