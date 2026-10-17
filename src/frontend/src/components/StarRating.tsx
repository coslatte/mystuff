import { messages } from "../lib/i18n/catalog";
import { useTranslations } from "../lib/i18n/useTranslations";
import { useState } from "react";

type Props = {
  value?: number;
  onRate?: (stars: number) => void;
};

export default function StarRating({ value = 0, onRate }: Props) {
  const t = useTranslations();
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center gap-1 border-2 border-brut-black bg-brut-surface p-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate?.(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          aria-label={t(messages.music.ratingLabel, { count: star })}
          className="text-2xl leading-none transition-none hover:scale-125 focus:outline-none"
        >
          <span className={active >= star ? "opacity-100" : "opacity-25"}>★</span>
        </button>
      ))}
      <span className="ml-2 border-l-2 border-brut-black pl-2 font-mono text-xs font-bold">
        {value > 0 ? `${value}/5` : t(messages.music.vote)}
      </span>
    </div>
  );
}
