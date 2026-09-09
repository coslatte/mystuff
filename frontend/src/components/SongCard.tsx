import type { Song } from "../types";

type Props = {
  song: Song;
  active: boolean;
  onSelect: (song: Song) => void;
};

const ratingLabel = (song: Song) =>
  song.avgRating != null ? `${song.avgRating.toFixed(1)} (${song.totalVotes ?? 0})` : "—";

export default function SongCard({ song, active, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(song)}
      className={`flex w-full items-center justify-between border-2 border-black bg-white p-4 text-left transition-colors ${
        active ? "bg-brut-yellow" : "hover:bg-neutral-100"
      }`}
    >
      <span className="flex items-center gap-4">
        <span className={`flex h-12 w-12 items-center justify-center border-2 border-black font-mono text-xs font-bold ${active ? "bg-brut-red text-white" : "bg-white"}`}>
          {active ? "play" : "stop"}
        </span>
        <span>
          <span className="block font-display text-lg font-bold leading-tight">{song.title}</span>
          <span className="font-mono text-xs text-gray-600">{song.artist}</span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="font-mono text-xs text-gray-600">{song.duration ?? "—"}</span>
        <span className="border border-black bg-black px-2 py-1 font-mono text-xs font-bold text-white">
          ★ {ratingLabel(song)}
        </span>
      </span>
    </button>
  );
}
