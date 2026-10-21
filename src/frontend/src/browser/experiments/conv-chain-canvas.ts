export function paintConvChain(canvas: HTMLCanvasElement, cells: Uint8Array, size: number, ink: string, paper: string, tiled: boolean) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = size * (tiled ? 2 : 1);
  if (canvas.width !== width || canvas.height !== width) {
    canvas.width = canvas.height = width;
  }
  const image = context.createImageData(width, width);
  const rgb = (hex: string) => [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16));
  const colors = [rgb(paper), rgb(ink)];
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const color = colors[cells[x % size + (y % size) * size]];
      const i = (x + y * width) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}
