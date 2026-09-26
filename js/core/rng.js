/**
 * rng.js — deterministic pseudo-random number generation.
 * Every simulation run is seeded so careers and results are reproducible.
 */

/** Mulberry32: fast, small-state, good enough for a game. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** float in [lo, hi) */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** integer in [lo, hi] inclusive */
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    /** true with probability p */
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Fisher–Yates, returns a new array */
    shuffle: (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
    /** Approximately normal (Irwin–Hall n=3), mean 0, sd ~1. */
    gauss: () => (next() + next() + next() - 1.5) * 1.4142,
    fork: () => makeRng(Math.floor(next() * 2 ** 31)),
  };
}

/** Stable 32-bit string hash — used to derive seeds from names. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const randomSeed = () => (Math.floor(Math.random() * 2 ** 31) >>> 0);
