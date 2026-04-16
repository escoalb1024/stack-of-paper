// RES-10 — Per-character jitter via seeded PRNG.
//
// Each character gets deterministic rotation/offset values seeded by its
// absolute index on the page. Using a PRNG (not Math.random) keeps results
// stable across re-renders even before values are written back into CharData,
// and also guarantees a fresh-looking distribution between adjacent chars
// (where Math.random would happen to be fine but not reproducible in tests).

// mulberry32 — one of the smallest decent 32-bit PRNGs. Good enough for
// visual jitter; not for anything cryptographic.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Jitter {
  rotation: number; // deg
  offsetX: number; // px
  offsetY: number; // px
}

// Per-char ranges from RES-10 spec.
const ROTATION_RANGE = 1.5; // ±1.5°
const OFFSET_X_RANGE = 0.5; // ±0.5px
const OFFSET_Y_RANGE = 1.0; // ±1px

// Map [0,1) → [-range, +range].
const centered = (r: number, range: number) => (r * 2 - 1) * range;

// Deterministic jitter for a character at absolute index `index`.
// The same index always produces the same jitter.
export function jitterFor(index: number): Jitter {
  // Offset the seed so index 0 doesn't land on a flat PRNG state.
  const rand = mulberry32(index + 1);
  return {
    rotation: centered(rand(), ROTATION_RANGE),
    offsetX: centered(rand(), OFFSET_X_RANGE),
    offsetY: centered(rand(), OFFSET_Y_RANGE),
  };
}
