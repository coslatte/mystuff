export type Stage = "connecting" | "waking" | "booting" | "almost" | "ready";

type Props = {
  stage: Stage;
};

/**
 * Cold-start indicator. `server-pulse.css` owns the shapes and the speed curve;
 * this only picks the stage.
 *
 * Decorative: the adjacent message carries the state for screen readers.
 */
export default function ServerPulse({ stage }: Props) {
  return (
    <span className="server-pulse shrink-0" aria-hidden="true">
      {/* Keyed on the stage so each new message sends out a fresh shockwave. */}
      <span key={stage} className="server-pulse__burst" />
      <span className={`server-pulse__box server-pulse__box--${stage} h-3.5 w-3.5`} />
    </span>
  );
}