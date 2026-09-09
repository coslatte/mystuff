type Props = {
  value?: number;
  onRate?: (stars: number) => void;
  readonly?: boolean;
};

export default function StarRating({ value = 0, onRate, readonly = false }: Props) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          disabled={readonly}
          onClick={() => onRate?.(s)}
          className={s <= value ? "text-yellow-400" : "text-zinc-600"}
          aria-label={`Rate ${s} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
