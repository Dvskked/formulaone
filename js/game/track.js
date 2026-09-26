/**
 * track.js â€” circuit geometry, spatial projection, racing line and pit lane.
 *
 * World units are metres. The centreline is a closed Catmull-Rom spline
 * resampled at a uniform spacing, which makes `s = index * spacing` and lets
 * every consumer (AI, physics, timing, renderer) share one coordinate system.
 *
 *   tangent  t = (dx, dy)          heading angle = atan2(dy, dx)
 *   right    r = (-dy, dx)         positive lateral = right of the racing direction
 */

import { clamp, lerp, TAU, wrapPi } from "../core/utils.js";

const SPACING = 5;          // metres between centreline samples
const MARGIN = 2.6;         // racing line keeps this much off the white line
const RUNOFF = 12;          // metres of run-off before the barrier
const PIT_LANE_OFFSET = 6;  // lane centre, measured from the track edge
const PIT_LANE_WIDTH = 7;
const PIT_GAP = 26;         // length of the in/out opening in the pit wall

/** Catmull-Rom interpolation (centripetal, alpha = 0.5). */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export class Track {
  /** @param {object} def entry from circuits-data.js */
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.short = def.short;
    this.country = def.country;
    this.flag = def.flag;
    this.abrasiveness = def.abrasiveness ?? 1;
    this.grip = def.grip ?? 1;
    this.temp = def.temp ?? 22;
    this.rain = def.rain ?? 0;
    this.sectorBias = def.sectorBias ?? [1 / 3, 1 / 3, 1 / 3];

    this.spacing = SPACING;
    this._build(def.points, def.length ?? 2900, def.width ?? 13);
    this._buildRacingLine();
    this._buildPitLane();
    this._buildSectors();
  }

  /* ------------------------------------------------------------------ */
  /* Construction                                                         */
  /* ------------------------------------------------------------------ */

  _build(controlPoints, targetLength) {
    // 1. Sample the closed spline at its natural size, then scale it so the
    //    finished lap length matches the circuit's published length exactly.
    const STEPS = 20;
    const dense = [];
    const n = controlPoints.length;
    for (let i = 0; i < n; i++) {
      const p0 = controlPoints[(i - 1 + n) % n], p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n], p3 = controlPoints[(i + 2) % n];
      for (let s = 0; s < STEPS; s++) {
        const t = s / STEPS;
        dense.push({
          x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
          y: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
          w: lerp(p1[2] ?? 13, p2[2] ?? 13, t),
        });
      }
    }

    let splineLen = 0;
    for (let i = 0; i < dense.length; i++) {
      const a = dense[i], b = dense[(i + 1) % dense.length];
      splineLen += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const scale = targetLength / splineLen;
    for (const p of dense) { p.x *= scale; p.y *= scale; }

    // Centre the finished loop on the world origin.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of dense) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    for (const p of dense) { p.x -= cx; p.y -= cy; }

    // 2. Resample at uniform arc-length spacing.
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1], b = dense[i % dense.length];
      cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    const total = cum[dense.length];
    const count = Math.max(64, Math.round(total / SPACING));
    this.length = count * SPACING;
    this.count = count;

    const px = new Float32Array(count), py = new Float32Array(count);
    const pw = new Float32Array(count);
    let seg = 0;
    for (let i = 0; i < count; i++) {
      const target = (i / count) * total;
      while (seg < dense.length - 1 && cum[seg + 1] < target) seg++;
      const t = (target - cum[seg]) / Math.max(1e-6, cum[seg + 1] - cum[seg]);
      const a = dense[seg], b = dense[(seg + 1) % dense.length];
      px[i] = lerp(a.x, b.x, t);
      py[i] = lerp(a.y, b.y, t);
      pw[i] = lerp(a.w, b.w, t);
    }


    this.px = px; this.py = py; this.pw = pw;

    // 4. Tangents, normals, curvature, half-widths.
    this.dx = new Float32Array(count);
    this.dy = new Float32Array(count);
    this.nx = new Float32Array(count);
    this.ny = new Float32Array(count);
    this.kappa = new Float32Array(count);
    this.halfWidth = new Float32Array(count);
    this.heading = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const a = (i - 1 + count) % count, b = (i + 1) % count;
      let tx = px[b] - px[a], ty = py[b] - py[a];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      this.dx[i] = tx; this.dy[i] = ty;
      this.nx[i] = -ty; this.ny[i] = tx;   // right-hand normal
      this.heading[i] = Math.atan2(ty, tx);
      this.halfWidth[i] = pw[i] / 2;
    }
    for (let i = 0; i < count; i++) {
      const a = (i - 1 + count) % count, b = (i + 1) % count;
      const cross = this.dx[a] * this.dy[b] - this.dy[a] * this.dx[b];
      const dot = clamp(this.dx[a] * this.dx[b] + this.dy[a] * this.dy[b], -1, 1);
      this.kappa[i] = Math.atan2(cross, dot) / (2 * SPACING);
    }
    // Smooth curvature (single pass, wrap-aware).
    const ks = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let acc = 0;
      for (let k = -2; k <= 2; k++) acc += this.kappa[(i + k + count) % count];
      ks[i] = acc / 5;
    }
    this.kappa = ks;

    // 5. Bounds + corner map (used by the minimap and the corner HUD).
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let i = 0; i < count; i++) {
      bx0 = Math.min(bx0, px[i]); bx1 = Math.max(bx1, px[i]);
      by0 = Math.min(by0, py[i]); by1 = Math.max(by1, py[i]);
    }
    this.bounds = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    this.corners = this._detectCorners();
  }

  _detectCorners() {
    const corners = [];
    const THRESH = 0.0022;   // 1/m â€” anything tighter than a ~450 m radius
    let start = -1;
    for (let i = 0; i < this.count; i++) {
      const k = Math.abs(this.kappa[i]);
      if (k > THRESH) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (i - start > 2) {
          let peak = start;
          for (let j = start; j < i; j++) if (Math.abs(this.kappa[j]) > Math.abs(this.kappa[peak])) peak = j;
          corners.push({ index: peak, s: peak * SPACING, severity: Math.abs(this.kappa[peak]), dir: Math.sign(this.kappa[peak]) });
        }
        start = -1;
      }
    }
    if (start >= 0 && this.count - start > 2) {
      let peak = start;
      for (let j = start; j < this.count; j++) if (Math.abs(this.kappa[j]) > Math.abs(this.kappa[peak])) peak = j;
      corners.push({ index: peak, s: peak * SPACING, severity: Math.abs(this.kappa[peak]), dir: Math.sign(this.kappa[peak]) });
    }
    corners.sort((a, b) => a.s - b.s);
    corners.forEach((c, i) => { c.number = i + 1; });
    return corners;
  }

  /* --------------------------- racing line --------------------------- */

  _buildRacingLine() {
    const { count, px, py, nx, ny, halfWidth } = this;
    const lx = new Float32Array(count), ly = new Float32Array(count);
    for (let i = 0; i < count; i++) { lx[i] = px[i]; ly[i] = py[i]; }

    const limit = new Float32Array(count);
    for (let i = 0; i < count; i++) limit[i] = Math.max(1, halfWidth[i] - MARGIN);

    const ITER = 320;
    const step = 0.36;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < count; i++) {
        const a = (i - 1 + count) % count, b = (i + 1) % count;
        const tx = (lx[a] + lx[b]) * 0.5;
        const ty = (ly[a] + ly[b]) * 0.5;
        let x = lerp(lx[i], tx, step);
        let y = lerp(ly[i], ty, step);
        // Keep the line inside the white line (local search only â€” cheap).
        const p = this._projectNear(x, y, i, 6);
        const lat = p.lateral;
        const cl = clamp(lat, -limit[i], limit[i]);
        if (cl !== lat) {
          x = px[i] + nx[i] * cl;
          y = py[i] + ny[i] * cl;
        }
        lx[i] = x; ly[i] = y;
      }
    }

    this.rlX = lx; this.rlY = ly;
    this.rlLateral = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.rlLateral[i] = (lx[i] - px[i]) * nx[i] + (ly[i] - py[i]) * ny[i];
    }

    // Curvature + speed profile of the racing line.
    this.rlKappa = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = (i - 1 + count) % count, b = (i + 1) % count;
      const ax = lx[i] - lx[a], ay = ly[i] - ly[a];
      const bx = lx[b] - lx[i], by = ly[b] - ly[i];
      const l1 = Math.hypot(ax, ay) || 1, l2 = Math.hypot(bx, by) || 1;
      const cross = (ax / l1) * (by / l2) - (ay / l1) * (bx / l2);
      const dot = clamp((ax / l1) * (bx / l2) + (ay / l1) * (by / l2), -1, 1);
      this.rlKappa[i] = Math.atan2(cross, dot) / SPACING;
    }
    this.rlSpeed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const k = Math.abs(this.rlKappa[i]);
      this.rlSpeed[i] = k < 1e-5 ? 999 : Math.sqrt(this.lateralAccel() / k);
    }
    // Backward pass: never arrive at a corner faster than it can be taken.
    for (let pass = 0; pass < 3; pass++) {
      for (let n = count - 1; n >= 0; n--) {
        const nxt = (n + 1) % count;
        const v = this.rlSpeed[nxt];
        const brake = 13.5;
        this.rlSpeed[n] = Math.min(this.rlSpeed[n], Math.sqrt(v * v + 2 * brake * SPACING));
      }
    }
    this.lapTimeEstimate = this.estimateLapTime();
  }

  _projectNear(x, y, hint, radius) {
    const { count, px, py } = this;
    let best = -1, bestD = Infinity;
    for (let k = -radius; k <= radius; k++) {
      const i = (hint + k + count * 2) % count;
      const d = (px[i] - x) ** 2 + (py[i] - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    // Refine against the two adjacent segments.
    let bi = best, bt = 0, bd = bestD;
    for (let k = -1; k <= 0; k++) {
      const i = (best + k + count) % count;
      const j = (i + 1) % count;
      const ax = px[i], ay = py[i];
      const vx = px[j] - ax, vy = py[j] - ay;
      const len2 = vx * vx + vy * vy || 1;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / len2, 0, 1);
      const cx = ax + vx * t, cy = ay + vy * t;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bd) { bd = d; bi = i; bt = t; }
    }
    const nx = this.nx[bi], ny = this.ny[bi];
    return {
      index: bi, t: bt,
      s: (bi + bt) * SPACING,
      lateral: (x - (px[bi] + (px[(bi + 1) % count] - px[bi]) * bt)) * nx +
               (y - (py[bi] + (py[(bi + 1) % count] - py[bi]) * bt)) * ny,
      dist2: bd,
    };
  }

  _nearestGlobal(x, y) {
    const { count, px, py } = this;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < count; i++) {
      const d = (px[i] - x) ** 2 + (py[i] - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return this._projectNear(x, y, best, 4);
  }

  /* ----------------------------- pit lane ----------------------------- */

  _buildPitLane() {
    // Find the longest low-curvature stretch in the first third of the lap.
    const searchFrom = Math.floor(this.count * 0.04);
    const searchTo = Math.floor(this.count * 0.3);
    const THRESH = 0.0016;
    let bestStart = -1, bestLen = 0, runStart = -1;
    for (let i = searchFrom; i <= searchTo; i++) {
      const straight = Math.abs(this.kappa[i % this.count]) < THRESH;
      if (straight) { if (runStart < 0) runStart = i; }
      else if (runStart >= 0) {
        const len = i - runStart;
        if (len > bestLen) { bestLen = len; bestStart = runStart; }
        runStart = -1;
      }
    }
    if (runStart >= 0 && searchTo - runStart > bestLen) { bestLen = searchTo - runStart; bestStart = runStart; }
    if (bestStart < 0 || bestLen * SPACING < 150) {
      bestStart = searchFrom;
      bestLen = Math.floor(150 / SPACING);
    }

    const centreIndex = bestStart + Math.floor(bestLen / 2);
    const entryS = ((bestStart * SPACING) - 40 + this.length) % this.length;
    const exitS = (((bestStart + bestLen) * SPACING) + 60) % this.length;
    this.pit = {
      entryS,
      exitS,
      wallS0: (entryS + 78) % this.length,
      wallS1: (exitS - 78 + this.length) % this.length,
      boxS: (centreIndex * SPACING) % this.length,
      offset: PIT_LANE_OFFSET,
      width: PIT_LANE_WIDTH,
      speedLimit: 22,          // m/s (80 km/h)
    };
  }

  /** Centre of a car's assigned slot across the pit lane. */
  pitLaneLateral(s, slot = 0) {
    const i = this.indexAt(s);
    return this.halfWidth[i] + this.pit.offset + ((((slot | 0) % 4) - 1.5) * 1.5);
  }

  /** Is the pit-lane opening reachable at this distance along the lap? */
  inPitWindow(s) {
    const p = this.pit;
    return sBetween(p.entryS, p.exitS, s, this.length);
  }

  /** Is the pit wall in the way here? (the box is the only walled part) */
  inPitWall(s) {
    const p = this.pit;
    return sBetween(p.wallS0, p.wallS1, s, this.length);
  }

  /** Lateral offset of the pit-lane centre at distance s, or null. */
  pitLateralAt(s) {
    if (!this.inPitWindow(s)) return null;
    const p = this.pit;
    const i = this.indexAt(s);
    return this.halfWidth[i] + p.offset;
  }

  /* ------------------------------ sectors ------------------------------ */

  _buildSectors() {
    // Split the lap proportionally to the configured bias, snapped to samples.
    const b = this.sectorBias;
    this.sectorS = [
      0,
      Math.floor((this.length * b[0]) / SPACING) * SPACING,
      Math.floor((this.length * (b[0] + b[1])) / SPACING) * SPACING,
      this.length,
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Queries                                                              */
  /* ------------------------------------------------------------------ */

  indexAt(s) {
    const n = this.count;
    let i = Math.floor(s / SPACING) % n;
    if (i < 0) i += n;
    return i;
  }

  sampleS(i) {
    return (i % this.count) * SPACING;
  }

  wrapS(s) {
    const L = this.length;
    s %= L;
    return s < 0 ? s + L : s;
  }

  /** Distance along the lap from `a` to `b` in [0, length). */
  delta(a, b) {
    let d = b - a;
    const L = this.length;
    d %= L;
    if (d < 0) d += L;
    return d;
  }

  /** Forward distance from a to b (may be negative if b is behind a). */
  signedDelta(a, b) {
    let d = (b - a) % this.length;
    if (d < 0) d += this.length;
    if (d > this.length / 2) d -= this.length;
    return d;
  }

  point(i) {
    const n = this.count;
    i = ((i % n) + n) % n;
    return { x: this.px[i], y: this.py[i] };
  }

  /** World position at arc length `s` with lateral offset. */
  pointAt(s, lateral = 0) {
    const L = this.length;
    s = ((s % L) + L) % L;
    const f = s / SPACING;
    const i = Math.floor(f) % this.count;
    const j = (i + 1) % this.count;
    const t = f - Math.floor(f);
    const x = lerp(this.px[i], this.px[j], t);
    const y = lerp(this.py[i], this.py[j], t);
    return { x: x + this.nx[i] * lateral, y: y + this.ny[i] * lateral };
  }

  /** Project a world position onto the track. `hint` = previous index. */
  project(x, y, hint = -1) {
    if (hint >= 0) {
      const p = this._projectNear(x, y, hint, 30);
      if (p.dist2 < 90 * 90) return p;
    }
    return this._nearestGlobal(x, y);
  }

  lateralOffsetAt(i, x, y) {
    return (x - this.px[i]) * this.nx[i] + (y - this.py[i]) * this.ny[i];
  }

  isOnTrack(i, lateral) {
    return Math.abs(lateral) <= this.halfWidth[i];
  }

  /** Physical grip ceiling of the layout (m/s^2). */
  lateralAccel() {
    return 27.5 * this.grip;
  }

  /** Track-limits speed for a corner at index i. */
  cornerSpeed(i, latAccel = this.lateralAccel()) {
    const k = Math.abs(this.rlKappa[i]);
    return k < 1e-5 ? 999 : Math.sqrt(latAccel / k);
  }

  /** Racing-line speed at arc length s. */
  rlSpeedAt(s) {
    return this.rlSpeed[this.indexAt(s)];
  }

  racingLinePoint(s) {
    const i = this.indexAt(s);
    return { x: this.rlX[i], y: this.rlY[i], index: i };
  }

  /** Nearest corner ahead of s, within `range` metres. */
  nextCorner(s, range = 400) {
    for (const c of this.corners) {
      if (this.delta(s, c.s) < range) return c;
    }
    return null;
  }

  /** Normalised position for the minimap. */
  toMap(x, y, w, h, pad = 8) {
    const b = this.bounds;
    const sx = (w - pad * 2) / (b.x1 - b.x0);
    const sy = (h - pad * 2) / (b.y1 - b.y0);
    const k = Math.min(sx, sy);
    const ox = pad + ((w - pad * 2) - (b.x1 - b.x0) * k) / 2;
    const oy = pad + ((h - pad * 2) - (b.y1 - b.y0) * k) / 2;
    return { x: ox + (x - b.x0) * k, y: oy + (y - b.y0) * k, k };
  }

  /** Rough estimate of a clean lap time in seconds. */
  estimateLapTime() {
    let t = 0;
    for (let i = 0; i < this.count; i++) {
      const v = Math.min(this.rlSpeed[i], 99);
      t += SPACING / v;
    }
    return t;
  }

  /** Rolling sample of the racing line for rendering the "ideal line". */
  forEachLinePoint(fn) {
    for (let i = 0; i < this.count; i++) fn(this.rlX[i], this.rlY[i], i);
  }
}

/** Is `b` ahead of `a` in the forward direction? Handles wrap-around. */
function sBetween(a, b, s, L) {
  if (a <= b) return s >= a && s <= b;
  return s >= a || s <= b;
}

export { SPACING as TRACK_SPACING, sBetween };
