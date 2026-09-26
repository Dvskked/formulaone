/**
 * utils.js — shared math, formatting and small helpers.
 * Pure module: no DOM access, safe to import in Node for headless simulation.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const MS_TO_KMH = 3.6;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

/** Frame-rate independent exponential approach. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Move `a` towards `b` by at most `maxDelta`. */
export function approach(a, b, maxDelta) {
  const d = b - a;
  if (Math.abs(d) <= maxDelta) return b;
  return a + Math.sign(d) * maxDelta;
}

/** Wrap radians into (-PI, PI]. */
export function wrapPi(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Shortest signed angular difference b - a, wrapped to (-PI, PI]. */
export const angleDelta = (a, b) => wrapPi(b - a);

export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/* --------------------------- easing --------------------------- */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* --------------------------- formatting --------------------------- */

/** 83.456 -> "1:23.456" ; 456.7 -> "7:36.700" */
export function formatTime(sec, decimals = 3) {
  if (sec == null || !isFinite(sec) || sec < 0) return "--:--." + "-".repeat(decimals);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, "0")}`;
}

/** Compact lap time used inside tight HUD slots: "1:23.45" */
export const formatLap = (sec) => formatTime(sec, 2);

/** Delta against a reference: "+0.412" / "-0.184" */
export function formatDelta(delta) {
  if (delta == null || !isFinite(delta)) return "—";
  const sign = delta >= 0 ? "+" : "−";
  const a = Math.abs(delta);
  return `${sign}${a.toFixed(3)}`;
}

/** Gap in seconds, shown with a "L" prefix when a lap down. */
export function formatGap(gap, lapsDown = 0) {
  if (lapsDown > 0) return `+${lapsDown}L`;
  if (gap == null) return "—";
  if (gap >= 100) return "+" + Math.floor(gap / 60) + ":" + String(Math.floor(gap % 60)).padStart(2, "0");
  return "+" + gap.toFixed(3);
}

export const formatClock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const money = (v) =>
  (v < 0 ? "−" : "") + "$" + Math.abs(Math.round(v)).toLocaleString("en-US");

export const kmh = (ms) => Math.round(ms * MS_TO_KMH);

/* --------------------------- misc --------------------------- */
let _uid = 0;
export const uid = (prefix = "id") => `${prefix}_${(++_uid).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

export const deepClone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function titleCase(s) {
  return String(s).replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

export function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Mix two hex colours (#rrggbb) — t=0 -> a, t=1 -> b. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

export function hexToRgba(hex, alpha) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${alpha})`;
}

/** Average of a numeric array. */
export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/** Insert `item` into an array sorted ascending by `key` (stable). */
export function insertSorted(arr, item, key = (x) => x) {
  const v = key(item);
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(arr[mid]) <= v) lo = mid + 1; else hi = mid;
  }
  arr.splice(lo, 0, item);
  return arr;
}
