import { usePlayer } from "../hooks/usePlayer";
import { player } from "../services/player";

export default function NowPlaying() {
  const { song, isPlaying } = usePlayer();

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3 px-4">
      {song ? (
        <>
          <button
            type="button"
            onClick={() => player.toggle()}
            aria-label={isPlaying ? "pause" : "play"}
            className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black bg-brut-yellow text-xs font-bold text-black hover:bg-brut-red hover:text-white"
          >
            {isPlaying ? "‖" : "▶"}
          </button>
          <span className="truncate font-mono text-sm font-bold">
            <span className="text-brut-red">now playing — </span>
            {song.title}
            <span className="normal-case text-gray-500"> · {song.artist}</span>
          </span>
        </>
      ) : (
        <span className="font-mono text-xs text-gray-400">nothing playing</span>
      )}
    </div>
  );
}
