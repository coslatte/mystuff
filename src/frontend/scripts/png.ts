/*
 * PNG encoder for verification runs.
 *
 * Not part of the site. It exists so a simulation can be judged by looking at it
 * instead of by looking at a row of statistics: every number this project has been
 * tuned on so far turned out to be satisfiable while the picture stayed wrong.
 */

import { deflateSync } from "node:zlib";

export type Pixels = Uint8ClampedArray;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePng(rgba: Pixels, width: number, height: number): Uint8Array {
  const stride = width * 4;
  // One filter byte per scanline. Filter 0 (none) keeps the writer trivial and
  // these images are written once for inspection, not served.
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    const from = y * stride;
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = rgba[from + i];
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(Buffer.from(raw)))),
    chunk("IEND", new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Scales RGBA up by an integer factor with nearest sampling, for inspection. */
export function upscale(rgba: Pixels, width: number, height: number, factor: number) {
  const outWidth = width * factor;
  const outHeight = height * factor;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const sy = (y / factor) | 0;
    for (let x = 0; x < outWidth; x++) {
      const sx = (x / factor) | 0;
      const from = (sy * width + sx) * 4;
      const to = (y * outWidth + x) * 4;
      out[to] = rgba[from];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from + 2];
      out[to + 3] = 255;
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}

/** Composites an RGBA tile onto an opaque light background. */
export function flatten(rgba: Pixels, background: [number, number, number] = [242, 242, 242]) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255;
    out[i] = rgba[i] * a + background[0] * (1 - a);
    out[i + 1] = rgba[i + 1] * a + background[1] * (1 - a);
    out[i + 2] = rgba[i + 2] * a + background[2] * (1 - a);
    out[i + 3] = 255;
  }
  return out;
}

/** Places a tile into a larger sheet at an offset. */
export function blit(
  sheet: Pixels,
  sheetWidth: number,
  tile: Pixels,
  tileWidth: number,
  tileHeight: number,
  atX: number,
  atY: number
): void {
  for (let y = 0; y < tileHeight; y++) {
    const from = y * tileWidth * 4;
    const to = ((atY + y) * sheetWidth + atX) * 4;
    for (let i = 0; i < tileWidth * 4; i++) sheet[to + i] = tile[from + i];
  }
}