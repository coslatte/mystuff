export type Stage = "connecting" | "waking" | "booting" | "almost" | "ready";

type Props = {
  stage: Stage;
};

/**
 * Cold-start indicator. `server-pulse.css` owns the blink timing; this only
 * picks the stage.
 *
 * Decorative: the adjacent message carries the state for screen readers.
 */
export default function ServerPulse({ stage }: Props) {
  return (
    <span className="server-pulse shrink-0" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className={`server-pulse__dot server-pulse__dot--${stage}`} />
      ))}
    </span>
  );
}
