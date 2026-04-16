// RES-10 smoke tests — runnable with `node --test lib/jitter.test.ts`.
// Node 23's built-in type stripping handles the TS syntax; no bundler needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { jitterFor, mulberry32 } from "./jitter.ts";

test("jitterFor is deterministic per index", () => {
  const a = jitterFor(42);
  const b = jitterFor(42);
  assert.deepEqual(a, b);
});

test("jitterFor produces different values for adjacent indices", () => {
  const a = jitterFor(0);
  const b = jitterFor(1);
  assert.notDeepEqual(a, b);
});

test("jitter values stay within spec ranges across 500 indices", () => {
  // RES-10 spec: rotation ±1.5°, offsetX ±0.5px, offsetY ±1px.
  for (let i = 0; i < 500; i++) {
    const { rotation, offsetX, offsetY } = jitterFor(i);
    assert.ok(Math.abs(rotation) <= 1.5, `rotation ${rotation} at i=${i}`);
    assert.ok(Math.abs(offsetX) <= 0.5, `offsetX ${offsetX} at i=${i}`);
    assert.ok(Math.abs(offsetY) <= 1.0, `offsetY ${offsetY} at i=${i}`);
  }
});

test("jitter distribution actually varies (not all zero)", () => {
  // A broken PRNG that always returns 0.5 would map to 0 for every field.
  // Catch that by requiring some non-trivial spread over a sample.
  const rotations = new Set<number>();
  for (let i = 0; i < 50; i++) rotations.add(jitterFor(i).rotation);
  assert.ok(rotations.size >= 40, `expected variety, got ${rotations.size} unique rotations`);
});

test("mulberry32 output is in [0, 1)", () => {
  const rand = mulberry32(12345);
  for (let i = 0; i < 1000; i++) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});
