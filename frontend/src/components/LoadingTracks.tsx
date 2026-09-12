type Props = {
  serverReady: boolean;
  elapsed: number;
};

type Status = {
  message: string;
  detail?: string;
};

// Honest copy only: the message mirrors what we actually know (whether the
// health probe answered and how long we have been waiting), it never fakes
// progress. Cold starts on free hosting can take a while, so we explain why.
function statusFor(serverReady: boolean, elapsed: number): Status {
  if (serverReady) {
    return { message: "server is awake — loading tracks...", detail: "this should only take a lil moment." };
  }
  if (elapsed < 3) {
    return { message: "connecting to the server..." };
  }
  if (elapsed < 10) {
    return {
      message: "ok the server was asleep: waking it up...",
      detail: "this is a normal cold start, hold on a few seconds.",
    };
  }
  if (elapsed < 25) {
    return {
      message: "still starting up — free hosting can take up to a minute on the first visit...",
      detail: "your patience is doing the heavy lifting here.",
    };
  }
  return {
    message: "almost there",
    detail: "(_　_)。゜zｚＺ",
  };
}

export default function LoadingTracks({ serverReady, elapsed }: Props) {
  const { message, detail } = statusFor(serverReady, elapsed);

  return (
    <div className="border-b-2 border-black bg-white p-6 tablet:p-8" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-3 w-3 shrink-0 border-2 border-black ${
            serverReady ? "bg-brut-green" : "bg-brut-yellow"
          }`}
        />
        <span key={message} className="text-morph font-mono text-sm font-bold">
          {message}
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
