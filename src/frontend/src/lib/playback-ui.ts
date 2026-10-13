export const PLAY_GLYPH = "▶";
export const PAUSE_GLYPH = "𐋃";

export function playPauseGlyph(isPlaying: boolean): string {
  return isPlaying ? PAUSE_GLYPH : PLAY_GLYPH;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// One source for all three play/pause toggles so they cannot drift apart.
export function playPauseClass(isPlaying: boolean, base: string): string {
  const state = isPlaying
    ? "bg-brut-red text-white hover:bg-black hover:text-white"
    : "bg-brut-blue text-white hover:bg-black hover:text-white";
  return `${base} ${state}`;
}
