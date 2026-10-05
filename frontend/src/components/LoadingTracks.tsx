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
      chunks: [
        { text: "we are " },
        { text: "finally", emphasis: true },
        { text: " awake: loading tracks..." },
      ],
      stage: "ready",
      detail: "this should only take a lil moment.",
    };
  }
  if (elapsed < 3) {
    return { chunks: [{ text: "connecting to the server..." }], stage: "connecting" };
  }
  if (elapsed < 10) {
    return {
      chunks: [{ text: "ok the server was asleep: waking it up..." }],
      stage: "waking",
      detail: "this is a normal cold start, hold on a few seconds.",
    };
  }
  if (elapsed < 25) {
    return {
      chunks: [{ text: "still starting up. free hosting can take up to a minute on the first visit..." }],
      stage: "booting",
      detail: "your patience is literally doing the heavy lifting here.",
    };
  }
  return {
    chunks: [{ text: "almost there" }],
    stage: "almost",
    detail: "(_　_)。゜zｚＺ",
  };
}

export default function LoadingTracks({ serverReady, elapsed }: Props) {
  const { chunks, stage, detail } = statusFor(serverReady, elapsed);
  const message = chunks.map((chunk) => chunk.text).join("");

  return (
    <div className="border-b-2 border-black bg-white p-6 tablet:p-8" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <ServerPulse stage={stage} />
        <span key={message} className="text-morph font-mono text-sm font-bold">
          {chunks.map((chunk, i) =>
            chunk.emphasis ? (
              <em key={i} className="italic">
                {chunk.text}
              </em>
            ) : (
              <Fragment key={i}>{chunk.text}</Fragment>
            )
          )}
        </span>
      </div>
      {detail && (
        <p key={detail} className="text-morph mt-2 font-mono text-xs text-gray-500">
          {detail}
        </p>
      )}
    </div>
  );
}