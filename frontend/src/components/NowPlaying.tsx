import { usePlayer } from "../hooks/usePlayer";
import { player } from "../services/player";

export default function NowPlaying() {
  const { song, isPlaying } = usePlayer();

  if (!song) {
    return (
      <div className="border-2 border-black bg-black px-3 py-1 font-mono text-xs font-bold normal-case text-white">
        nothing playing
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 border-2 border-black bg-black p-2">
      <button
        type="button"
        onClick={() => player.toggle()}
        aria-label={isPlaying ? "pause" : "play"}
        className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-xs font-bold transition-colors ${
          isPlaying
            ? "bg-brut-red text-white hover:bg-black hover:text-white"
            : "bg-brut-yellow text-black hover:bg-black hover:text-white"
        }`}
      >
        <span key={isPlaying ? "pause" : "play"} className="icon-morph">
          {isPlaying ? "𐋃" : "▶"}
        </span>
      </button>
      <p className="truncate font-mono text-xs font-bold leading-tight normal-case text-white">
        <span className="text-brut-red">{song.title}</span>
        <span className="text-white">
          {song.artist ? ` · ${song.artist}` : ""}
          {song.duration ? ` · ${song.duration}` : ""}
        </span>
      </p>
    </div>
  );
}
