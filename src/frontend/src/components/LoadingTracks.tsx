import { useTranslations } from "../lib/i18n/useTranslations";
import { Fragment } from "react";
import ServerPulse, { type Stage } from "./ServerPulse";

type Props = {
  serverReady: boolean;
  elapsed: number;
};

type Chunk = {
  text: string;
  emphasis?: boolean;
};

type Status = {
  chunks: Chunk[];
  stage: Stage;
  detail?: string;
};

// Plain fragments rather than a substring to highlight, so editing a message can
// never silently drop the emphasis.
function statusFor(serverReady: boolean, elapsed: number): Status {
  if (serverReady) {
    return {
      chunks: [{ text: "Loading tracks..." }],
      stage: "ready",
      detail: "The server is ready.",
    };
  }
  if (elapsed < 3) {
    return { chunks: [{ text: "connecting to the server..." }], stage: "connecting" };
  }
  if (elapsed < 10) {
    return {
      chunks: [{ text: "Starting the server..." }],
      stage: "waking",
      detail: "The first request may take up to a minute.",
    };
  }
  if (elapsed < 25) {
    return {
      chunks: [{ text: "Waiting for the server..." }],
      stage: "booting",
      detail: "Tracks will load when the connection is ready.",
    };
  }
  return {
    chunks: [{ text: "Waiting for the server..." }],
    stage: "almost",
    detail: "If this continues, reload the page.",
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
                {t.text(chunk.text)}
              </em>
            ) : (
              <Fragment key={i}>{t.text(chunk.text)}</Fragment>
            )
          )}
        </span>
      </div>
      {detail && (
        <p key={detail} className="text-morph mt-2 font-mono text-xs text-brut-muted">
          {t.text(detail)}
        </p>
      )}
    </div>
  );
}
