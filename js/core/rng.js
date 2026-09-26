// Generador pseudoaleatorio determinista (mulberry32) para carreras reproducibles.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = typeof seed === 'string' ? hashString(seed) : (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    seed: a,
    next,
    float: (min = 0, max = 1) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(pick) {
      const items = Array.isArray(pick) ? pick : pick.items;
      const weightOf = Array.isArray(pick) ? pick.weight : pick.weightOf;
      let total = 0;
      for (const it of items) total += Math.max(0, weightOf(it));
      if (total <= 0) return items[0];
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weightOf(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Ruido gaussiano centrado en 0 */
    gauss: (spread = 1) => {
      let s = 0;
      for (let i = 0; i < 4; i++) s += next();
      return (s - 2) * 0.8660254 * spread;
    },
    /** Deriva suave: número estable que cambia poco entre llamadas */
    drift: (key, step = 0.01) => {
      const h = hashString(`${a}:${key}`);
      const x = (h % 10000) / 10000;
      return (x - 0.5) * 2 * step;
    },
    fork(label) {
      return makeRng((a ^ hashString(String(label))) >>> 0);
    },
  };
  return rng;
}

export function randomSeed() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
