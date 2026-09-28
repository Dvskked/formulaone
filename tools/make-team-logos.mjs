// Genera el escudo de las escuderías que no tienen un logo oficial en Wikimedia.
//   node tools/make-team-logos.mjs
//
// Los ficheros PNG salen con fondo transparente en assets/teams/<serie>/<id>.png.
// Es un script de mantenimiento: los PNG generados se versionan en el repo y el
// juego no lo necesita en tiempo de ejecución.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { F1_TEAMS, F2_TEAMS } from '../js/data/teams.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Escuderías sin escudo oficial publicado: se les dibuja uno con sus colores. */
const GENERATED = {
  f1: ['racingbulls'],
  f2: ['invicta', 'hitech', 'campos', 'dams', 'prema', 'art', 'trident'],
};

const SIZE = 128;
const SS = 4; /* supermuestreo para que los bordes queden suaves */

/* ─────────────────────── lienzo ─────────────────────── */

function makeCanvas(w, h) {
  return { w, h, px: new Uint8ClampedArray(w * h * 4) };
}

function blend(canvas, x, y, [r, g, b], alpha) {
  if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return;
  const i = (y * canvas.w + x) * 4;
  const dst = canvas.px;
  const a = Math.max(0, Math.min(1, alpha));
  const da = dst[i + 3] / 255;
  const outA = a + da * (1 - a);
  if (outA <= 0) return;
  dst[i] = (r * a + dst[i] * da * (1 - a)) / outA;
  dst[i + 1] = (g * a + dst[i + 1] * da * (1 - a)) / outA;
  dst[i + 2] = (b * a + dst[i + 2] * da * (1 - a)) / outA;
  dst[i + 3] = outA * 255;
}

function fillPolygon(canvas, points, color, alpha = 1) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if (y1 === y2) continue;
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      if (y + 0.5 < lo || y + 0.5 >= hi) continue;
      hits.push(x1 + ((y + 0.5 - y1) / (y2 - y1)) * (x2 - x1));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const from = Math.max(0, Math.ceil(hits[i]));
      const to = Math.min(canvas.w - 1, Math.floor(hits[i + 1]));
      for (let x = from; x <= to; x++) blend(canvas, x, y, color, alpha);
    }
  }
}

function strokePolygon(canvas, points, color, width, alpha = 1) {
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      const r = width / 2;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          const d = Math.hypot(dx, dy);
          const cover = Math.max(0, Math.min(1, r - d + 0.5));
          if (cover > 0) blend(canvas, Math.round(cx + dx), Math.round(cy + dy), color, alpha * cover);
        }
      }
    }
  }
}

/* ─────────────────────── fuente 5x7 ─────────────────────── */

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10011', '01111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

function drawText(canvas, text, centerX, centerY, pixel, color, alpha = 1) {
  const chars = [...text];
  const gap = 1;
  const totalW = chars.length * 5 * pixel + (chars.length - 1) * gap * pixel;
  let x = Math.round(centerX - totalW / 2);
  for (const ch of chars) {
    const glyph = GLYPHS[ch.toUpperCase()];
    if (!glyph) throw new Error(`Sin glifo para "${ch}"`);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== '1') continue;
        for (let dy = 0; dy < pixel; dy++) {
          for (let dx = 0; dx < pixel; dx++) {
            blend(canvas, x + col * pixel + dx, Math.round(centerY - (7 * pixel) / 2) + row * pixel + dy, color, alpha);
          }
        }
      }
    }
    x += 5 * pixel + gap * pixel;
  }
  return totalW;
}

/** Pega `layer` sobre `canvas` únicamente donde `mask` tenga cobertura. */
function clipLayer(canvas, mask, layer) {
  for (let i = 0; i < canvas.px.length; i += 4) {
    const cover = mask.px[i + 3] / 255;
    if (cover <= 0) continue;
    const la = (layer.px[i + 3] / 255) * cover;
    if (la <= 0) continue;
    canvas.px[i] = layer.px[i] * la + canvas.px[i] * (1 - la);
    canvas.px[i + 1] = layer.px[i + 1] * la + canvas.px[i + 1] * (1 - la);
    canvas.px[i + 2] = layer.px[i + 2] * la + canvas.px[i + 2] * (1 - la);
    canvas.px[i + 3] = la * 255 + canvas.px[i + 3] * (1 - la);
  }
}

/* ─────────────────────── PNG ─────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Serializa un lienzo RGBA a PNG (sin perks, sin fondo). */
function encodePng(canvas) {
  const { w, h, px } = canvas;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; /* filtro none */
    Buffer.from(px.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; /* bits por canal */
  ihdr[9] = 6; /* RGBA */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Reduce el lienzo supermuestreado al tamaño final con promediado de bloques. */
function downsample(canvas, factor) {
  const w = Math.round(canvas.w / factor);
  const h = Math.round(canvas.h / factor);
  const out = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const i = ((y * factor + sy) * canvas.w + (x * factor + sx)) * 4;
          r += canvas.px[i];
          g += canvas.px[i + 1];
          b += canvas.px[i + 2];
          a += canvas.px[i + 3];
        }
      }
      const n = factor * factor;
      const j = (y * w + x) * 4;
      out.px[j] = r / n;
      out.px[j + 1] = g / n;
      out.px[j + 2] = b / n;
      out.px[j + 3] = a / n;
    }
  }
  return out;
}

/* ─────────────────────── escudo ─────────────────────── */

function hexToRgb(hex) {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance(rgb) {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Contorno del escudo: hombros rectos y punta redondeada abajo. */
function shieldOutline(w, h, inset) {
  const left = inset;
  const right = w - inset;
  const top = inset;
  const shoulder = top + (h - inset * 2) * 0.42;
  const points = [[left, top], [right, top], [right, shoulder]];
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    /* Cuadrática de Bézier desde el hombro derecho hasta la punta */
    const x = (1 - t) ** 2 * right + 2 * (1 - t) * t * right + t ** 2 * (w / 2);
    const y = (1 - t) ** 2 * shoulder + 2 * (1 - t) * t * (h - inset) + t ** 2 * (h - inset);
    points.push([x, y]);
  }
  for (let i = steps - 1; i >= 0; i--) {
    const t = i / steps;
    const x = (1 - t) ** 2 * left + 2 * (1 - t) * t * left + t ** 2 * (w / 2);
    const y = (1 - t) ** 2 * shoulder + 2 * (1 - t) * t * (h - inset) + t ** 2 * (h - inset);
    points.push([x, y]);
  }
  return points;
}

function drawCrest(team) {
  const w = SIZE * SS;
  const h = SIZE * SS;
  const canvas = makeCanvas(w, h);
  const livery = team.livery || {};
  const primary = hexToRgb(livery.primary || '#3a4152');
  const secondary = hexToRgb(livery.secondary || '#15161c');
  const accent = hexToRgb(livery.accent || '#ffffff');

  const dark = luminance(primary) < 0.5;
  const body = mix(primary, secondary, dark ? 0.15 : 0.1);
  const ink = dark ? [252, 252, 254] : [18, 19, 24];
  const border = mix(accent, [255, 255, 255], 0.25);

  const inset = Math.round(w * 0.06);
  const outline = shieldOutline(w, h, inset);

  /* Sombra inferior para que el escudo no quede plano */
  fillPolygon(canvas, outline.map(([x, y]) => [x, y + h * 0.012]), [0, 0, 0], 0.25);
  fillPolygon(canvas, outline, body, 1);

  /* Las bandas se dibujan aparte y se recortan con la silueta del escudo */
  const mask = makeCanvas(w, h);
  fillPolygon(mask, outline, [255, 255, 255], 1);

  const bands = makeCanvas(w, h);
  fillPolygon(bands, [
    [inset, h * 0.16],
    [w - inset, h * 0.16],
    [w - inset, h * 0.215],
    [inset, h * 0.215],
  ], secondary, 0.85);
  fillPolygon(bands, [
    [inset, h * 0.56],
    [w - inset, h * 0.44],
    [w - inset, h * 0.58],
    [inset, h * 0.70],
  ], accent, 0.92);
  clipLayer(canvas, mask, bands);

  /* Borde */
  strokePolygon(canvas, outline, border, Math.max(2, w * 0.016), 1);

  /* Código de la escudería */
  const code = (team.code || '').toUpperCase();
  const pixel = Math.max(2, Math.round(w * (code.length > 3 ? 0.036 : 0.046)));
  const textY = h * 0.36;
  /* Halo para que el texto se lea sobre cualquier color */
  drawText(canvas, code, w / 2, textY + Math.max(1, pixel / 3), pixel, dark ? [0, 0, 0] : [255, 255, 255], 0.35);
  drawText(canvas, code, w / 2, textY, pixel, ink);

  return downsample(canvas, SS);
}

function main() {
  let made = 0;
  for (const [series, ids] of Object.entries(GENERATED)) {
    const teams = series === 'f2' ? F2_TEAMS : F1_TEAMS;
    for (const id of ids) {
      const team = teams.find((t) => t.id === id);
      if (!team) throw new Error(`Escudería desconocida: ${series}/${id}`);
      const png = encodePng(drawCrest(team));
      const dir = join(ROOT, 'assets', 'teams', series);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${id}.png`);
      writeFileSync(file, png);
      made++;
      console.log(`  escudo generado ${series}/${id}.png (${(png.length / 1024).toFixed(1)} kB) · ${team.name}`);
    }
  }
  console.log(`${made} escudos generados en assets/teams/`);
}

main();
