const GAIN = 1.12;
const NOISE = 0.025;
const DOT_SPACING = 3;
const DOT_RADIUS = 0.8;

export function applyNoiseAndGain(density: number, x: number, y: number): number {
  const noise = (hash(x, y) - 0.5) * NOISE;
  return clamp((density - 0.5) * GAIN + 0.5 + noise);
}

export function drawHalftone(context: CanvasRenderingContext2D, width: number, height: number): void {
  const columns = Math.ceil(width / DOT_SPACING);
  const rows = Math.ceil(height / DOT_SPACING);
  context.fillStyle = "rgba(0, 0, 0, 0.08)";
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      context.beginPath();
      context.arc(x * DOT_SPACING + DOT_SPACING / 2, y * DOT_SPACING + DOT_SPACING / 2, DOT_RADIUS, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
