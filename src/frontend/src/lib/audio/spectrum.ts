const SPECTRUM_COLORS: [number, [number, number, number]][] = [
  [-120, [255, 255, 255]],
  [-80, [210, 170, 255]],
  [-40, [125, 145, 255]],
  [-10, [255, 140, 155]],
  [0, [255, 255, 255]],
];

export function spectrumColor(decibels: number): string {
  // Infinity cannot be an interpolation endpoint; silence fades to white at -120 dB.
  const db = Math.max(-120, Math.min(0, decibels));
  for (let i = 1; i < SPECTRUM_COLORS.length; i++) {
    const [upperDb, upper] = SPECTRUM_COLORS[i];
    if (db > upperDb) continue;
    const [lowerDb, lower] = SPECTRUM_COLORS[i - 1];
    const ratio = (db - lowerDb) / (upperDb - lowerDb);
    const channels = lower.map((channel, index) =>
      Math.round(channel + (upper[index] - channel) * ratio)
    );
    return `rgb(${channels.join(", ")})`;
  }
  return "#ffffff";
}
