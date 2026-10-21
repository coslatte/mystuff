/* Adapted from https://github.com/mxgmn/ConvChain/blob/master/ConvChainFast.cs
 * The MIT License (MIT)
 * Copyright(c) mxgmn 2016.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

export type PatternSize = 2 | 3 | 4;
export type ConvChainModel = {
  patternSize: PatternSize;
  logWeights: Float64Array;
};

const wrap = (value: number, size: number) => (value + size) % size;

export function learnConvChain(sample: readonly string[], patternSize: PatternSize, symmetry: boolean): ConvChainModel {
  const size = sample.length;
  if (size < patternSize || sample.some(row => row.length !== size || /[^01]/.test(row))) {
    throw new RangeError("ConvChain requires a square binary sample at least as large as its pattern.");
  }
  const weights = new Float64Array(2 ** (patternSize * patternSize));
  for (let sy = 0; sy < size; sy++) {
    for (let sx = 0; sx < size; sx++) {
      for (let transform = 0; transform < (symmetry ? 8 : 1); transform++) {
        let index = 0;
        for (let y = 0; y < patternSize; y++) {
          for (let x = 0; x < patternSize; x++) {
            let tx = transform >= 4 ? patternSize - 1 - x : x, ty = y;
            for (let turn = 0; turn < transform % 4; turn++) {
              [tx, ty] = [patternSize - 1 - ty, tx];
            }
            if (sample[(sy + ty) % size][(sx + tx) % size] === "1") index |= 1 << (y * patternSize + x);
          }
        }
        weights[index]++;
      }
    }
  }
  // The original epsilon keeps unseen patterns possible, so the chain can escape a local minimum.
  return { patternSize, logWeights: weights.map(weight => Math.log(weight || 0.1)) };
}

export function createConvChain(model: ConvChainModel, size: number, seed: number) {
  if (!Number.isInteger(size) || size < model.patternSize || size > 128 || !Number.isFinite(seed)) {
    throw new RangeError("ConvChain output must be an integer from the pattern size to 128, with a finite seed.");
  }
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const cells = Uint8Array.from({ length: size * size }, () => random() >= 0.5 ? 1 : 0);
  const indices = new Uint16Array(cells.length);
  const { patternSize: n, logWeights } = model;
  for (let sy = 0; sy < size; sy++) {
    for (let sx = 0; sx < size; sx++) {
      let index = 0;
      for (let dy = 0; dy < n; dy++) {
        for (let dx = 0; dx < n; dx++) {
          index |= cells[(sx + dx) % size + ((sy + dy) % size) * size] << (dy * n + dx);
        }
      }
      indices[sx + sy * size] = index;
    }
  }
  let attempts = 0;
  return {
    cells,
    size,
    get attempts() { return attempts; },
    step(count: number, temperature: number) {
      if (!Number.isInteger(count) || count < 0 || !Number.isFinite(temperature) || temperature <= 0) {
        throw new RangeError("ConvChain needs a nonnegative integer step count and positive temperature.");
      }
      for (let attempt = 0; attempt < count; attempt++) {
        const pixel = Math.floor(random() * cells.length);
        const x = pixel % size, y = Math.floor(pixel / size);
        let delta = 0;
        // Only N² pattern origins contain this pixel; all other weight ratios cancel.
        // Cached indices reduce each proposal from O(N⁴) to O(N²), including wrapped edges.
        for (let dy = 0; dy < n; dy++) {
          for (let dx = 0; dx < n; dx++) {
            const origin = wrap(x - dx, size) + wrap(y - dy, size) * size;
            const index = indices[origin];
            delta += logWeights[index ^ (1 << (dy * n + dx))] - logWeights[index];
          }
        }
        // Log weights avoid overflow when multiplying many very small pattern probabilities.
        if (delta >= 0 || Math.log(random()) < delta / temperature) {
          cells[pixel] ^= 1;
          for (let dy = 0; dy < n; dy++) {
            for (let dx = 0; dx < n; dx++) {
              const origin = wrap(x - dx, size) + wrap(y - dy, size) * size;
              indices[origin] ^= 1 << (dy * n + dx);
            }
          }
        }
      }
      attempts += count;
    },
  };
}

export type ConvChain = ReturnType<typeof createConvChain>;
