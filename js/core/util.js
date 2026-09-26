// Utilidades matemáticas, de formato y de fecha.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const mix = lerp;
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const mod = (a, n) => ((a % n) + n) % n;

/** Diferencia angular normalizada en (-PI, PI]. */
export function angleDelta(a, b) {
  let d = mod(b - a + Math.PI, TAU) - Math.PI;
  if (d === -Math.PI) d = Math.PI;
  return d;
}

export function wrapAngle(a) {
  return mod(a, TAU);
}

export function moveTowards(current, target, maxDelta) {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + sign(d) * maxDelta;
}

export function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

export function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function fmtInt(n) {
  return Math.round(n).toLocaleString('es-ES');
}

/** 83456 -> "1:23.456" */
export function fmtLap(ms) {
  if (!isFinite(ms) || ms <= 0) return '--:--.---';
  const total = Math.floor(ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const t = total % 1000;
  return `${m}:${pad2(s)}.${String(t).padStart(3, '0')}`;
}

/** Sector / vuelta corta -> "23.456" */
export function fmtShort(ms) {
  if (!isFinite(ms) || ms <= 0) return '--.---';
  return (ms / 1000).toFixed(3);
}

export function fmtGap(ms) {
  if (!isFinite(ms) || ms === 0) return '—';
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    return `+${m}:${pad2(Math.floor((ms % 60000) / 1000))}`;
  }
  if (ms >= 1000) return `+${(ms / 1000).toFixed(3)}`;
  return `+${(ms / 1000).toFixed(3)}`;
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function toIso(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function addDays(iso, days) {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function dayName(iso) {
  return DIAS[parseDate(iso).getUTCDay()];
}

export function fmtDate(iso, opts = {}) {
  const d = parseDate(iso);
  const mes = opts.short ? MESES_CORTO[d.getUTCMonth()] : MESES[d.getUTCMonth()];
  if (opts.compact) return `${d.getUTCDate()} ${mes}`;
  return `${d.getUTCDate()} de ${mes} de ${d.getUTCFullYear()}`;
}

export function fmtDayDate(iso) {
  const d = parseDate(iso);
  return `${DIAS[d.getUTCDay()][0].toUpperCase() + DIAS[d.getUTCDay()].slice(1)} ${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]}`;
}

export function weekday(iso) {
  return DIAS[parseDate(iso).getUTCDay()].slice(0, 3);
}

/** Intervalo tipo "6–8 MAR" a partir de dos fechas ISO. */
export function fmtRange(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (da.getUTCMonth() === db.getUTCMonth()) {
    return `${da.getUTCDate()}–${db.getUTCDate()} ${MESES_CORTO[db.getUTCMonth()]}`;
  }
  return `${da.getUTCDate()} ${MESES_CORTO[da.getUTCMonth()]} – ${db.getUTCDate()} ${MESES_CORTO[db.getUTCMonth()]}`;
}

export function ordinal(n) {
  const s = ['º', 'º', 'º', 'º', 'º', 'º', 'º', 'º', 'º', 'º'];
  return `${n}${s[Math.min(9, Math.max(0, n - 1))]}`;
}

export function titleCase(str) {
  return String(str).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Interpolación segura de plantillas: {{clave}} */
export function tpl(str, data) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (m, k) => (data && k in data ? data[k] : m));
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const c = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(lerp(A.r, B.r, t), lerp(A.g, B.g, t), lerp(A.b, B.b, t));
}

export function shade(hex, amount) {
  return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount);
}

export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function readableOn(hex) {
  return luminance(hex) > 0.58 ? '#0b0c10' : '#ffffff';
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Número de posiciones conuko formato ordinal corto: 1º, 2º… */
export function pos(n) {
  return `${n}º`;
}

export function sum(arr, pick = (v) => v) {
  return arr.reduce((a, v) => a + (pick(v) || 0), 0);
}

export function last(arr) {
  return arr && arr.length ? arr[arr.length - 1] : undefined;
}

export function byDesc(pick) {
  return (a, b) => pick(b) - pick(a);
}

export function groupBy(arr, pick) {
  const out = new Map();
  for (const item of arr) {
    const k = pick(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* cae al JSON */
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/** Aproximación de una gaussiana por suma de uniformes (rápida y estable). */
export function gauss(rng) {
  return (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 0.8660254;
}

export function pickWeighted(rng, items, weightOf) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items[0];
  let r = rng.next() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
