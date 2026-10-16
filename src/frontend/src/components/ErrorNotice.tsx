import { useTranslations } from "../hooks/useTranslations";
import { errorReference, isRetryable, userMessage } from "../services/errors";

type Props = {
  error: unknown;
  onRetry?: () => void;
  className?: string;
};

export default function ErrorNotice({ error, onRetry, className }: Props) {
  const t = useTranslations();
  const reference = errorReference(error);
  const canRetry = onRetry && isRetryable(error);

  return (
    <div
      role="alert"
      className={`bg-brut-red p-4 font-mono text-sm text-brut-on-accent ${className ?? ""}`}
    >
      <p>{t(userMessage(error))}</p>

      {reference && <p className="mt-1 text-xs opacity-90">{t("Reference: ")}{t(reference)}</p>}

      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 border-2 border-brut-black px-3 py-1 text-xs font-bold hover:bg-brut-surface hover:text-brut-black"
        >{t("retry")}</button>
      )}

      {import.meta.env.DEV && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-bold">{t("technical details")}</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all bg-brut-inverse p-2 text-brut-on-accent">
            {t(error instanceof Error ? `${error.name}: ${error.message}` : String(error))}
          </pre>
        </details>
      )}
    </div>
  );
}
