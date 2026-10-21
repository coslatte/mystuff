import assert from "node:assert/strict";
import { test } from "node:test";
import { createConvChain, learnConvChain, type PatternSize } from "../conv-chain";

const sample = ["1100", "1100", "0011", "0011"];
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("learning counts wrapped patterns and all eight symmetries without deduplication", () => {
  for (const n of [2, 3, 4] satisfies PatternSize[]) {
    for (const symmetry of [false, true]) {
      const model = learnConvChain(sample, n, symmetry);
      let total = 0;
      for (const logWeight of model.logWeights) {
        const weight = Math.exp(logWeight);
        if (weight > 0.5) total += weight;
        else close(weight, 0.1);
      }
      close(total, 16 * (symmetry ? 8 : 1));
    }
  }
  const uniform = learnConvChain(["1111", "1111", "1111", "1111"], 4, true);
  close(Math.exp(uniform.logWeights[65535]), 128);
  close(Math.exp(uniform.logWeights[0]), 0.1);
  const wrapped = learnConvChain(["1000", "0000", "0000", "0000"], 2, false);
  for (const index of [1, 2, 4, 8]) close(Math.exp(wrapped.logWeights[index]), 1);
});

test("cached Metropolis proposals agree with full-field energy, including toroidal seams", () => {
  for (const n of [2, 3, 4] satisfies PatternSize[]) {
    const model = learnConvChain(sample, n, true);
    const size = 5;
    const seed = 42;
    const fast = createConvChain(model, size, seed);
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    const cells = Uint8Array.from({ length: size * size }, () => random() >= 0.5 ? 1 : 0);
    const logProbability = () => {
      let result = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let index = 0;
          for (let dy = 0; dy < n; dy++) {
            for (let dx = 0; dx < n; dx++) index += cells[(x + dx) % size + ((y + dy) % size) * size] * 2 ** (dx + dy * n);
          }
          result += model.logWeights[index];
        }
      }
      return result;
    };
    for (let attempt = 0; attempt < 100; attempt++) {
      const temperature = attempt < 50 ? 0.5 : 1.8;
      const pixel = Math.floor(random() * cells.length);
      const before = logProbability();
      cells[pixel] ^= 1;
      const delta = logProbability() - before;
      if (!(delta >= -1e-9 || Math.log(random()) < delta / temperature)) cells[pixel] ^= 1;
      fast.step(1, temperature);
      assert.deepEqual(fast.cells, cells, `N=${n}, attempt ${attempt}`);
    }
  }
});

test("seeds reproduce the output independently of animation batching", () => {
  const model = learnConvChain(sample, 3, true);
  const one = createConvChain(model, 24, 7);
  const batches = createConvChain(model, 24, 7);
  one.step(24 * 24 * 5, 1);
  for (let i = 0; i < 5; i++) batches.step(24 * 24, 1);
  assert.deepEqual(one.cells, batches.cells);
  assert.equal(one.attempts, 24 * 24 * 5);
  assert.ok(one.cells.every(value => value === 0 || value === 1));
  assert.notDeepEqual(one.cells, createConvChain(model, 24, 8).cells);
});

test("invalid samples and nonpositive temperatures are rejected", () => {
  assert.throws(() => learnConvChain(["0", "11"], 2, true), RangeError);
  assert.throws(() => learnConvChain(["xx", "11"], 2, true), RangeError);
  const model = learnConvChain(sample, 2, false);
  assert.throws(() => createConvChain(model, 129, 0), RangeError);
  assert.throws(() => createConvChain(model, 16.5, 0), RangeError);
  assert.throws(() => createConvChain(model, 16, NaN), RangeError);
  assert.throws(() => createConvChain(model, 16, 0).step(1, 0), RangeError);
});
