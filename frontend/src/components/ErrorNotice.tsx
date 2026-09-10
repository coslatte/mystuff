import { errorReference, isRetryable, userMessage } from "../services/errors";

type Props = {
  error: unknown;
  onRetry?: () => void;
  className?: string;
};

export default function ErrorNotice({ error, onRetry, className }: Props) {
  const reference = errorReference(error);
  const canRetry = onRetry && isRetryable(error);

  return (
    <div
      role="alert"
      className={`border-2 border-black bg-brut-red p-4 font-mono text-sm text-white ${className ?? ""}`}
    >
      <p>{userMessage(error)}</p>

      {reference && <p className="mt-1 text-xs opacity-90">Reference: {reference}</p>}

      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 border-2 border-white px-3 py-1 text-xs font-bold hover:bg-white hover:text-black"
        >
          retry
        </button>
      )}

      {import.meta.env.DEV && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-bold">technical details</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all bg-black p-2">
            {error instanceof Error ? `${error.name}: ${error.message}` : String(error)}
          </pre>
        </details>
      )}
    </div>
  );
}
