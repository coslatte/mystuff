import { useState } from "react";

type Props = {
  value?: number;
  onRate?: (stars: number) => void;
  readonly?: boolean;
};

export default function StarRating({ value = 0, onRate, readonly = false }: Props) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center gap-1 border-2 border-black bg-white p-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          aria-label={`rate ${star} of 5`}
          className="text-2xl leading-none transition-none hover:scale-125 focus:outline-none"
        >
          <span className={active >= star ? "opacity-100" : "opacity-25"}>★</span>
        </button>
      ))}
      <span className="ml-2 border-l-2 border-black pl-2 font-mono text-xs font-bold">
        {value > 0 ? `${value}/5` : "vote"}
      </span>
    </div>
  );
}
