// Construcción de circuitos a partir de un trazado compacto de segmentos.
// Genera línea central, anchura, pianos, boxes, zonas DRS, sectores y línea de carrera.

import { clamp, dist, TAU, mod } from '../core/util.js';

const STEP = 5; // metros entre muestras brutas
const RELAX_ITERATIONS = 600;
const DAMPING = 0.62;
const MAX_STEP = 26;
/** fracción máxima de giro contrario respecto al giro dominante */
const NEGATIVE_SHARE = 0.42;

/**
 * DSL de segmentos:
 *   ['s', largo]                 recta
 *   ['c', radio, grados]         curva (signo + = derecha)
 *   ['e', largo, amplitud, n]    esses: n curvas alternas
 */
function parseSegments(def, radiusFactor = 1) {
  const segs = [];
  for (const seg of def.seg) {
    const kind = seg[0];
    if (kind === 's') {
      segs.push({ kind: 's', length: seg[1], base: seg[1], index: 0 });
    } else if (kind === 'c') {
      segs.push({ kind: 'c', radius: Math.max(20, seg[1] * radiusFactor), angle: seg[2], esses: false });
    } else if (kind === 'e') {
      const [, length, , count] = seg;
      const steps = Math.max(2, count);
      const stepLen = length / steps;
      const angle = (360 / (steps + (steps % 2 === 0 ? 1 : 0))) * 0.6;
      const radius = Math.max(35, stepLen / Math.tan((angle * Math.PI) / 360));
      for (let i = 0; i < steps; i++) {
        segs.push({ kind: 'c', radius, angle: i % 2 === 0 ? angle : -angle, esses: true });
      }
    }
  }
  /* numerar el índice inicial de cada segmento dentro de la polilínea */
  let idx = 0;
  for (const s of segs) {
    s.index = idx;
    idx += s.kind === 's' ? Math.max(1, Math.round(s.length / STEP)) : Math.max(2, Math.round(((s.radius * Math.abs(s.angle)) / 180) * Math.PI / STEP));
  }
  return segs;
}

function walk(segs) {
  const pts = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  let h = 0;
  for (const seg of segs) {
    if (seg.kind === 's') {
      const n = Math.max(1, Math.round(seg.length / STEP));
      const step = seg.length / n;
      for (let i = 0; i < n; i++) {
        x += Math.cos(h) * step;
        y += Math.sin(h) * step;
        pts.push({ x, y });
      }
    } else {
      const rad = (Math.abs(seg.angle) * Math.PI) / 180;
      const n = Math.max(2, Math.round((seg.radius * rad) / STEP));
      const stepA = rad / n;
      const stepL = (seg.radius * rad) / n;
      const dir = seg.angle >= 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        x += Math.cos(h) * stepL;
        y += Math.sin(h) * stepL;
        h += dir * stepA;
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

/**
 * Normaliza el giro total a 360 grados. Los giros contrarios se limitan para
 * que el lazo sea simple (nunca se cruza consigo mismo), conservando el carácter
 * de cada chicana.
 */
function normaliseTurn(segs) {
  const corners = segs.filter((s) => s.kind === 'c' && Math.abs(s.angle) > 0.5);
  if (!corners.length) return;
  const sum = corners.reduce((a, c) => a + c.angle, 0);
  const dir = sum >= 0 ? 1 : -1;
  let pos = 0;
  let neg = 0;
  for (const c of corners) {
    if (c.angle * dir > 0) pos += Math.abs(c.angle);
    else neg += Math.abs(c.angle);
  }
  if (neg > 0 && neg > pos * NEGATIVE_SHARE) {
    const f = (pos * NEGATIVE_SHARE) / neg;
    for (const c of corners) {
      if (c.angle * dir < 0) c.angle *= f;
    }
  }
  const total = corners.reduce((a, c) => a + c.angle, 0);
  if (Math.abs(total) < 1) return;
  const factor = clamp((dir * 360) / total, 0.4, 2.5);
  for (const c of corners) c.angle *= factor;
}

function closeLoop(segs, targetLength = 0) {
  normaliseTurn(segs);
  const straights = segs.filter((s) => s.kind === 's');
  const relax = (iterations) => {
    let pts = walk(segs);
    for (let iter = 0; iter < iterations; iter++) {
      const end = pts[pts.length - 1];
      const ex = pts[0].x - end.x;
      const ey = pts[0].y - end.y;
      const err = Math.hypot(ex, ey);
      if (err < 0.4) break;
      let aligned = 0;
      for (const s of straights) {
        const a = pts[Math.min(s.index, pts.length - 2)];
        const b = pts[Math.min(s.index + 1, pts.length - 1)];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        s.dirX = dx / l;
        s.dirY = dy / l;
        aligned += s.dirX * ex + s.dirY * ey;
      }
      if (Math.abs(aligned) < 0.5) break;
      const factor = (DAMPING * err) / aligned;
      for (const s of straights) {
        const proj = s.dirX * ex + s.dirY * ey;
        s.length = clamp(s.length + clamp(proj * factor, -MAX_STEP, MAX_STEP), s.base * 0.45, s.base * 2.6);
      }
      pts = walk(segs);
    }
    return pts;
  };

  let pts = relax(RELAX_ITERATIONS);
  if (!targetLength) return pts;

  /* La longitud oficial manda: se corrige solo con las rectas para que los
     radios de las curvas (y por tanto las curvas lentas) se respeten */
  for (let pass = 0; pass < 3; pass++) {
    const len = polyLength(pts);
    if (Math.abs(len - targetLength) / targetLength < 0.004) break;
    const k = targetLength / len;
    for (const s of straights) {
      s.length = clamp(s.length * k, 12, 4000);
      s.base = s.length;
    }
    pts = relax(Math.max(6, RELAX_ITERATIONS >> 1));
  }
  return pts;
}

/** Rota y corrige el trazado para que el lazo cierre de forma continua. */
function fitClosed(pts) {
  const n = pts.length;
  const headStart = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  const last = pts[n - 1];
  const prev = pts[n - 2];
  const headEnd = Math.atan2(last.y - prev.y, last.x - prev.x);
  const delta = mod(headEnd - headStart + Math.PI, TAU) - Math.PI;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  const cosA = Math.cos(-delta);
  const sinA = Math.sin(-delta);
  const out = pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cosA - dy * sinA, y: cy + dx * sinA + dy * cosA };
  });
  /* el hueco residual se reparte a lo largo del lazo para no crear un raíl */
  let acc = 0;
  const s = new Array(n);
  for (let i = 0; i < n; i++) {
    s[i] = acc;
    acc += dist(out[i].x, out[i].y, out[(i + 1) % n].x, out[(i + 1) % n].y);
  }
  const gx = out[0].x - out[n - 1].x;
  const gy = out[0].y - out[n - 1].y;
  for (let i = 0; i < n - 1; i++) {
    const t = s[i] / acc;
    out[i].x -= gx * t;
    out[i].y -= gy * t;
  }
  out[n - 1].x = out[0].x;
  out[n - 1].y = out[0].y;
  return out;
}

function polyLength(pts) {
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    total += dist(a.x, a.y, b.x, b.y);
  }
  return total;
}

function resample(pts, spacing) {
  const out = [];
  const closed = pts.concat([pts[0]]);
  let carry = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    const d = dist(a.x, a.y, b.x, b.y);
    if (d < 1e-6) continue;
    let t = carry;
    while (t < d) {
      const f = t / d;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      t += spacing;
    }
    carry = t - d;
  }
  return out;
}

function smoothField(pts, key, radius, passes) {
  const m = pts.length;
  for (let pass = 0; pass < passes; pass++) {
    const src = pts.map((p) => p[key]);
    for (let i = 0; i < m; i++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[(i + k + m) % m];
      pts[i][key] = sum / (radius * 2 + 1);
    }
  }
}

function arcBetween(pts, from, to) {
  const m = pts.length;
  let total = 0;
  let i = mod(from, m);
  let guard = 0;
  while (i !== mod(to, m) && guard++ < m * 2) {
    const a = pts[i % m];
    const b = pts[(i + 1) % m];
    total += dist(a.x, a.y, b.x, b.y);
    i++;
  }
  return total;
}

function findDrsZones(track) {
  const pts = track.points;
  const m = pts.length;
  const zones = [];
  const minLen = 190;
  let start = -1;
  for (let i = 0; i <= m; i++) {
    const p = pts[i % m];
    const straight = Math.abs(p.curv) < 0.0035 && p.radius > 300;
    const valid = i > 8 && i < m - 8;
    if (straight && valid) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      const end = Math.min(i, m);
      if (arcBetween(pts, start, end) >= minLen) zones.push({ from: start % m, to: end % m, length: arcBetween(pts, start, end) });
      start = -1;
    }
  }
  return zones;
}

function buildRacingLine(track, aggression) {
  const pts = track.points;
  const m = pts.length;
  const off = new Array(m);
  for (let i = 0; i < m; i++) {
    const p = pts[i];
    const radius = p.radius;
    if (radius > 1e4) off[i] = 0;
    else {
      const strength = clamp((1600 - radius) / 1350, 0, 1);
      off[i] = -Math.sign(p.curv || 1) * (p.halfWidth - 2.4) * strength * aggression;
    }
  }
  for (let pass = 0; pass < 24; pass++) {
    const src = off.slice();
    for (let i = 0; i < m; i++) off[i] = src[(i - 1 + m) % m] * 0.26 + src[i] * 0.48 + src[(i + 1) % m] * 0.26;
  }
  const line = new Array(m);
  for (let i = 0; i < m; i++) {
    const p = pts[i];
    const limit = Math.max(0, p.halfWidth - 2.1);
    const o = clamp(off[i], -limit, limit);
    line[i] = { x: p.x + p.nx * o, y: p.y + p.ny * o, offset: o, idx: i };
  }
  return line;
}

function buildPit(track) {
  const pts = track.points;
  const entryS = track.length * 0.955;
  const exitS = track.length * 0.06;
  const laneOffset = track.baseWidth * 0.5 + 6.8;
  const path = [];
  const steps = 72;
  /* La calle de boxes nunca puede invadir la pista: si el trazado pasa cerca
     de otro tramo del circuito, se busca el apartamiento que la deja libre,
     probando ambos lados antes de renunciar */
  const clearOffset = (p, idx, off) => {
    const candidates = [];
    for (const sign of [-1, 1]) {
      for (const k of [1, 1.3, 1.6, 2, 2.5]) candidates.push({ sign, k });
    }
    let best = null;
    for (const { sign, k } of candidates) {
      const dist = off * k;
      const x = p.x - p.nx * dist * sign;
      const y = p.y - p.ny * dist * sign;
      if (!projectCar(track, x, y, idx).onTrack) return dist * sign;
      if (!best) best = dist * sign;
    }
    return best;
  };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = entryS + (exitS - entryS + track.length) * t;
    const idx = indexAtS(track, s);
    const p = pts[idx];
    const ease = Math.pow(Math.sin(Math.min(1, Math.max(0, t)) * Math.PI), 0.5);
    const off = clearOffset(p, idx, Math.max(1.2, laneOffset * ease));
    path.push({ x: p.x - p.nx * off, y: p.y - p.ny * off, idx });
  }
  const boxes = [];
  const boxCount = 11;
  for (let i = 0; i < boxCount; i++) {
    const t = 0.2 + (i / (boxCount - 1)) * 0.44;
    const k = Math.round(t * (path.length - 1));
    const pt = path[k];
    const nxt = path[Math.min(path.length - 1, k + 1)];
    boxes.push({ x: pt.x, y: pt.y, heading: Math.atan2(nxt.y - pt.y, nxt.x - pt.x), index: i });
  }
  return { entryS, exitS, path, boxes, halfWidth: 5.8, speedLimit: 22.2, laneOffset };
}

function toPath(pts, step) {
  let d = '';
  let i = 0;
  for (i = 0; i < pts.length; i += step) {
    d += `${i === 0 ? 'M' : 'L'}${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} `;
  }
  return `${d}Z`;
}

/** Construye la geometría de un circuito con un factor de radio dado. */
function assemble(def, radiusFactor, spacing = 4.2) {
  const segs = parseSegments(def, radiusFactor);
  const target = def.length * 1000;
  const closed = fitClosed(closeLoop(segs, target));
  /* la escala final solo corrige el residuo: los radios ya son escala real */
  const k = target / polyLength(closed);
  for (const p of closed) {
    p.x *= k;
    p.y *= k;
  }
  const pts = resample(closed, spacing);
  const m = pts.length;

  /* distancias acumuladas (con vuelta) para medir sobre arco real */
  let acc = 0;
  for (let i = 0; i < m; i++) {
    pts[i].s = acc;
    acc += dist(pts[i].x, pts[i].y, pts[(i + 1) % m].x, pts[(i + 1) % m].y);
  }
  const total = acc;

  for (let i = 0; i < m; i++) {
    const prev = pts[(i - 1 + m) % m];
    const next = pts[(i + 1) % m];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const l = Math.hypot(dx, dy) || 1;
    pts[i].dirX = dx / l;
    pts[i].dirY = dy / l;
    pts[i].nx = -dy / l;
    pts[i].ny = dx / l;
  }

  /* curvatura sobre una ventana de arco fija: estable frente a uneven spacing */
  const W = 3 * spacing;
  const ext = (i) => pts[((i % m) + m) % m];
  const sAt = (i) => pts[((i % m) + m) % m].s + (i >= m ? total : 0) * Math.floor(i / m);
  let j = 0;
  for (let i = 0; i < m; i++) {
    if (j < i + 1) j = i + 1;
    const si = sAt(i);
    while (j < i + m - 1 && sAt(j) - si < W) j++;
    const si1 = sAt(i + 1);
    const sj = sAt(j);
    const a = ext(i);
    const b = ext(i + 1);
    const c = ext(j);
    const h0 = Math.atan2(b.y - a.y, b.x - a.x);
    const h1 = Math.atan2(c.y - b.y, c.x - b.x);
    const arc = Math.max(0.5, sj - si1);
    pts[i].curv = (mod(h1 - h0 + Math.PI, TAU) - Math.PI) / arc;
  }
  smoothField(pts, 'curv', 5, 2);

  /* Trazado ancho: 18-20 m de asfalto, como en los trazados actuales. Las
     zonas lentas se ensanchan un poco más y las rápidas se estrechan menos. */
  const baseWidth = def.width || 19;
  for (let i = 0; i < m; i++) {
    const p = pts[i];
    const radius = Math.max(25, 1 / Math.max(1e-5, Math.abs(p.curv)));
    p.radius = radius;
    const fast = clamp((radius - 90) / 700, 0, 1);
    const slow = clamp((190 - radius) / 160, 0, 1);
    p.halfWidth = baseWidth * (0.5 - 0.03 * fast + 0.1 * slow);
    p.kerb = radius < 150 ? 1 : 0;
    /* Zona de escapatoria: hay grava en las curvas lentas y asfalto liso en
       el resto, para que salirse no sea siempre lo mismo */
    p.runoff = slow > 0.35 ? 'gravel' : fast > 0.5 ? 'asphalt' : 'grass';
  }
  smoothField(pts, 'halfWidth', 6, 2);

  const track = {
    def,
    id: def.id,
    name: def.name,
    gp: def.gp,
    city: def.city,
    country: def.country,
    flag: def.flag,
    record: def.record || '—',
    night: Boolean(def.night),
    weather: def.weather || 'dry',
    surfaceGrip: def.grip ?? 1,
    baseWidth,
    points: pts,
    n: m,
    length: acc,
    startIdx: 0,
    sectors: [acc * 0.33, acc * 0.66],
    corners: def.corners || [],
  };

  track.drsZones = findDrsZones(track);
  track.line = buildRacingLine(track, 0.85);
  track.lineAggressive = buildRacingLine(track, 1.06);
  track.idealLap = idealLapTime(track, 1);
  track.pit = buildPit(track);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  track.bounds = { minX: minX - 95, minY: minY - 95, maxX: maxX + 95, maxY: maxY + 95 };
  track.center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  track.span = Math.max(maxX - minX, maxY - minY);
  track.mapPath = toPath(pts, 3);

  const startP = pts[0];
  track.start = { x: startP.x, y: startP.y, heading: Math.atan2(startP.dirY, startP.dirX) };
  track.radiusFactor = radiusFactor;
  return track;
}

/** Convierte "1:15.481" en segundos. */
export function recordSeconds(record) {
  if (typeof record !== 'string') return 0;
  const parts = record.split(':').map((n) => parseFloat(n));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const CACHE = new Map();

/**
 * Construye un circuito completo. La longitud se ajusta a la oficial, el lazo
 * se cierra relajando las rectas y el número de vueltas sale de la distancia
 * de carrera, no al revés.
 */
export function buildTrack(def) {
  const cached = CACHE.get(def.id);
  if (cached) return cached;
  const track = assemble(def, 1, 4.2);
  /* distancia de carrera al estilo F1: alrededor de 300 km */
  const distance = def.distance || 300;
  track.laps = clamp(Math.round(distance / (track.length / 1000)), 20, 95);
  track.raceDistance = track.laps * (track.length / 1000);
  /* récord de referencia jugable: algo más lento que el límite teórico */
  track.referenceLap = track.idealLap * 1.035;
  CACHE.set(def.id, track);
  return track;
}

/** Perfil de velocidad ideal (m/s) según curvatura y agarre. */
export function speedProfile(track, gripFactor = 1) {
  const pts = track.points;
  const m = pts.length;
  const v = new Array(m);
  const latAccel = 17.8 * gripFactor;
  for (let i = 0; i < m; i++) {
    const k = Math.max(1e-5, Math.abs(pts[i].curv));
    v[i] = clamp(Math.sqrt(latAccel / k), 11, 97);
  }
  const accel = 11.5 * gripFactor;
  const decel = 27 * gripFactor;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = m - 1; i >= 0; i--) {
      const next = v[(i + 1) % m];
      const ds = dist(pts[i].x, pts[i].y, pts[(i + 1) % m].x, pts[(i + 1) % m].y);
      v[i] = Math.min(v[i], Math.sqrt(next * next + 2 * decel * ds));
    }
    for (let i = 0; i < m; i++) {
      const prev = v[(i - 1 + m) % m];
      const ds = dist(pts[i].x, pts[i].y, pts[(i - 1 + m) % m].x, pts[(i - 1 + m) % m].y);
      v[i] = Math.min(v[i], Math.sqrt(prev * prev + 2 * accel * ds));
    }
  }
  return v;
}

export function idealLapTime(track, gripFactor = 1) {
  const v = speedProfile(track, gripFactor);
  const pts = track.points;
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    const ds = dist(pts[i].x, pts[i].y, next.x, next.y);
    const speed = Math.max(6, (v[i] + v[(i + 1) % pts.length]) / 2);
    total += ds / speed;
  }
  return total * 1000;
}

export function indexAtS(track, s) {
  const pts = track.points;
  const target = mod(s, track.length);
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Distancia, hacia atras desde la linea de meta, del punto de salida para una
 * sesion de cronometraje. Se elige el punto mas cercano a la meta que aun tenga
 * `minRun` metros de recta por delante: el coche sale rodando, acelera sin curva
 * y llega a la linea en el sitio y en el momento que se espera, sin regalar
 * media vuelta de pista.
 */
export function straightBeforeLine(track, minRun = 140, maxLook = 250, step = 5) {
  const pts = track.points;
  const n = pts.length;
  const paso = pts[1] && pts[0] ? pts[1].s - pts[0].s : 4.2;
  const tope = Math.ceil(minRun / paso);
  for (let d = maxLook; d >= 60; d -= step) {
    const i0 = indexAtS(track, mod(-d, track.length));
    let largo = 0;
    for (let k = 0; k < tope; k++) {
      /* Radio mayor de 125 m: se puede seguir la trazada sin salirse */
      if (Math.abs(pts[(i0 + k) % n].curv || 0) >= 0.008) break;
      largo += paso;
    }
    if (largo >= minRun) return d;
  }
  return 60;
}

export function pointAtS(track, s) {
  return track.points[indexAtS(track, s)];
}

/** Proyecta el coche sobre la pista: índice, avance, distancia lateral. */
export function projectCar(track, x, y, hint = 0) {
  const pts = track.points;
  const m = pts.length;
  let best = mod(hint, m);
  let bestD = Infinity;
  const window = 48;
  for (let k = -window; k <= window; k++) {
    const i = mod(hint + k, m);
    const p = pts[i];
    const dx = x - p.x;
    const dy = y - p.y;
    const along = dx * p.dirX + dy * p.dirY;
    const lateral = dx * p.nx + dy * p.ny;
    const d = Math.abs(lateral) + Math.max(0, Math.abs(along) - 4) * 2.5;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  /* si el resultado local es dudioso, se busca el punto más cercano real */
  if (bestD > 6) {
    let gBest = best;
    let gD = Infinity;
    for (let i = 0; i < m; i++) {
      const d = dist(x, y, pts[i].x, pts[i].y);
      if (d < gD) {
        gD = d;
        gBest = i;
      }
    }
    if (gD + 1.5 < bestD) {
      best = gBest;
      bestD = gD;
    }
  }
  const p = pts[best];
  const dx = x - p.x;
  const dy = y - p.y;
  const along = dx * p.dirX + dy * p.dirY;
  const lateral = dx * p.nx + dy * p.ny;
  return {
    idx: best,
    s: mod(p.s + along, track.length),
    lateral,
    dist: Math.abs(lateral),
    dirX: p.dirX,
    dirY: p.dirY,
    heading: Math.atan2(p.dirY, p.dirX),
    halfWidth: p.halfWidth,
    onTrack: Math.abs(lateral) <= p.halfWidth + 0.4,
    kerb: Math.abs(lateral) > p.halfWidth - 1.0 && Math.abs(lateral) <= p.halfWidth + 1.6 && p.kerb === 1,
    radius: p.radius,
    curv: p.curv,
  };
}

export function inDrsZone(track, idx) {
  for (const z of track.drsZones) {
    if (z.to > z.from) {
      if (idx >= z.from && idx <= z.to) return z;
    } else if (idx >= z.from || idx <= z.to) return z;
  }
  return null;
}

export function sectorAt(track, s) {
  if (s < track.sectors[0]) return 1;
  if (s < track.sectors[1]) return 2;
  return 3;
}

export function nearestPitDistance(track, x, y) {
  let best = Infinity;
  const path = track.pit.path;
  for (let i = 0; i < path.length; i++) {
    const d = dist(x, y, path[i].x, path[i].y);
    if (d < best) best = d;
  }
  return best;
}

export function inPitLane(track, x, y) {
  return nearestPitDistance(track, x, y) < track.pit.halfWidth + 1.2;
}

/**
 * Minimapa en un viewBox de 0 0 100 100. Devuelve la traza ya proyectada y las
 * piezas (línea de meta, boxes) listas para dibujar.
 */
export function minimap(track, step = 2) {
  const b = track.bounds;
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const scale = Math.min(100 / w, 100 / h);
  const ox = (100 - w * scale) / 2;
  const oy = (100 - h * scale) / 2;
  const px = (x) => (x - b.minX) * scale + ox;
  const py = (y) => (y - b.minY) * scale + oy;
  const pts = track.points;
  let d = '';
  for (let i = 0; i < pts.length; i += step) {
    d += `${i === 0 ? 'M' : 'L'}${px(pts[i].x).toFixed(2)} ${py(pts[i].y).toFixed(2)} `;
  }
  const last = pts[pts.length - 1];
  d += `L${px(pts[0].x).toFixed(2)} ${py(pts[0].y).toFixed(2)} Z`;
  const pitPath = track.pit.path
    .filter((_, i) => i % 2 === 0)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`)
    .join(' ');
  const start = track.start;
  const startLine = {
    x1: px(start.x + start.dirY * 9),
    y1: py(start.y - start.dirX * 9),
    x2: px(start.x - start.dirY * 9),
    y2: py(start.y + start.dirX * 9),
  };
  return {
    d,
    pitPath,
    startLine,
    scale,
    ox,
    oy,
    minX: b.minX,
    minY: b.minY,
    project(x, y) {
      return { x: px(x), y: py(y) };
    },
  };
}
