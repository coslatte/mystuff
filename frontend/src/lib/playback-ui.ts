export const PLAY_GLYPH = "▶";
export const PAUSE_GLYPH = "𐋃";

export function playPauseGlyph(isPlaying: boolean): string {
  return isPlaying ? PAUSE_GLYPH : PLAY_GLYPH;
}

// One source for all three play/pause toggles so they cannot drift apart.
export function playPauseClass(isPlaying: boolean, base: string): string {
  const state = isPlaying
    ? "bg-brut-red text-white hover:bg-black hover:text-white"
    : "bg-brut-yellow text-black hover:bg-black hover:text-white";
  return `${base} ${state}`;
}