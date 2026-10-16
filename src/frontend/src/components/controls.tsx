import { useTranslations } from "../hooks/useTranslations";
/*
 * Form primitives.
 *
 * The two shapes every control panel on this site is built from. Extracted because
 * both interactive pages need them and a slider that lives in two places is a
 * slider whose label eventually disagrees with its range.
 *
 * Presentational only: each one reports through a setter and holds no state.
 */

import type { ReactNode } from "react";

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  /** Overrides the value colour, for the one knob that is a warning and not a choice. */
  accent?: string;
  hint?: ReactNode;
  onChange: (value: number) => void;
};

export function Slider({ label, value, min, max, step, format, accent, hint, onChange }: SliderProps) {
  const t = useTranslations();
  return (
    <label className="brut-label block">
      <span className="flex items-baseline justify-between gap-2">
        {t(label)}
        <span className={accent ?? "text-brut-link"}>{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full"
      />
      {hint ? <span className="mt-1 block font-mono text-[10px] font-normal normal-case text-brut-muted">{t(hint)}</span> : null}
    </label>
  );
}

type ChipsProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
};

/** A segmented choice. Used wherever the set of options is small and fixed. */
export function Chips<T extends string>({ label, value, options, onChange }: ChipsProps<T>) {
  const t = useTranslations();
  return (
    <div>
      <p className="brut-label mb-1">{t(label)}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={option === value}
            className={`border-2 border-brut-black px-2 py-1 font-mono text-xs font-bold ${
              option === value ? "bg-brut-inverse text-brut-on-accent" : "bg-brut-surface hover:bg-brut-blue hover:text-brut-on-accent"
            }`}
          >
            {t(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Toggle({ label, checked, onChange }: ToggleProps) {
  const t = useTranslations();
  return (
    <label className="brut-label flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-brut-blue"
      />
      {t(label)}
    </label>
  );
}

type PanelProps = {
  title: string;
  children: ReactNode;
  /** Rendered on the right of the header, for a control that belongs to the group. */
  aside?: ReactNode;
};

export function Panel({ title, children, aside }: PanelProps) {
  const t = useTranslations();
  return (
    <section className="brut-panel">
      <header className="flex items-center justify-between gap-2 border-b-2 border-brut-black bg-brut-inverse px-3 py-2">
        <h2 className="font-mono text-xs font-bold uppercase text-brut-on-accent">{t(title)}</h2>
        {aside}
      </header>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </section>
  );
}
