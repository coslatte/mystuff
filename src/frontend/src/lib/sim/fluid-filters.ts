const TILE_SIZE = 48;
const DOT_SPACING = 3;

export function applyGain(density: number): number {
  return Math.max(0, Math.min(1, (density - 0.5) * 1.12 + 0.5));
}

export function createFluidFilter(context: CanvasRenderingContext2D, scale: number): CanvasPattern | null {
  const size = TILE_SIZE * scale;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;

  const tileContext = tile.getContext("2d");
  if (!tileContext) return null;

  const noise = tileContext.createImageData(size, size);
  for (let i = 0; i < noise.data.length; i += 4) {
    noise.data[i + 3] = Math.random() * 22;
  }
  tileContext.putImageData(noise, 0, 0);

  tileContext.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = DOT_SPACING / 2; y < TILE_SIZE; y += DOT_SPACING) {
    for (let x = DOT_SPACING / 2; x < TILE_SIZE; x += DOT_SPACING) {
      tileContext.beginPath();
      tileContext.arc(x * scale, y * scale, 0.8 * scale, 0, Math.PI * 2);
      tileContext.fill();
    }
  }

  return context.createPattern(tile, "repeat");
}

export function drawFluidFilter(
  context: CanvasRenderingContext2D,
  pattern: CanvasPattern | null,
  width: number,
  height: number
): void {
  if (!pattern) return;
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
}
