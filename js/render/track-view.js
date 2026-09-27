// Renderizador de la vista superior del circuito: asfalto, pianos, línea de meta,
// zona de DRS, boxes y coches. Trabaja en coordenadas del circuito y se
// transforma al lienzo con una cámara que sigue al jugador.

import {
  ASPHALT, ASPHALT_DARK, CARBON, GRASS, KERB_BLUE, KERB_RED, WHITE,
  alpha, readableOn, teamColor, teamSecondary,
} from './palette.js';

const CAMERAS = {
  1: { zoom: 2.4, name: 'Cockpit' },
  2: { zoom: 1.5, name: 'Cámara alta' },
  3: { zoom: 0.9, name: 'Cenital' },
  4: { zoom: 0, name: 'Completa' },
};

export class TrackView {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = 2;
    this.cameraPos = null;
    this.zoom = 1.5;
    this.rotate = false;
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.track = null;
    this.staticLayer = null;
    this.resize();
  }

  setTrack(track, teamsById = {}) {
    this.track = track;
    this.teamsById = teamsById;
    this.staticLayer = null;
    this.cameraPos = null;
  }

  setCamera(index) {
    this.camera = CAMERAS[index] ? index : 2;
  }

  get cameraName() {
    return CAMERAS[this.camera].name;
  }

  cycleCamera() {
    this.setCamera((this.camera % 4) + 1);
    return this.cameraName;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.staticLayer = null;
  }

  /** Escala para encuadrar el circuito completo. */
  fullTrackScale() {
    if (!this.track) return 1;
    const b = this.track.bounds;
    return Math.min(this.width / (b.maxX - b.minX), this.height / (b.maxY - b.minY)) * 0.86;
  }

  /** @param {object} state estado de sesión de race.js */
  draw(state) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    if (!this.track) {
      ctx.restore();
      return;
    }

    const target = this.computeTransform(state);
    this.zoom += (target.zoom - this.zoom) * 0.14;
    if (this.cameraPos) {
      this.cameraPos.x += (target.x - this.cameraPos.x) * 0.16;
      this.cameraPos.y += (target.y - this.cameraPos.y) * 0.16;
    } else {
      this.cameraPos = { x: target.x, y: target.y };
    }
    this.rotate += ((target.rotate ? 1 : 0) - this.rotate) * 0.12;

    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    if (this.rotate > 0.01) ctx.rotate(this.rotate * (Math.PI / 180) * 0);
    ctx.translate(-this.cameraPos.x * this.zoom, -this.cameraPos.y * this.zoom);
    ctx.scale(this.zoom, this.zoom);

    this.drawGround(ctx);
    this.drawTrack(ctx, state);
    this.drawStartLine(ctx);
    this.drawDrsMarkers(ctx);
    this.drawCars(ctx, state);
    ctx.restore();

    this.drawVignette(ctx);
    ctx.restore();
  }

  computeTransform(state) {
    const full = this.fullTrackScale();
    const p = state?.player;
    if (this.camera === 4 || !p) return { zoom: full, x: this.track.center.x, y: this.track.center.y, rotate: false };
    const cfg = CAMERAS[this.camera];
    const ahead = 26 + p.speed * 0.55;
    const x = p.x + Math.cos(p.angle) * ahead;
    const y = p.y + Math.sin(p.angle) * ahead;
    const zoom = cfg.zoom > 1 ? Math.max(full, 1.15 * cfg.zoom) : Math.max(full, cfg.zoom);
    return { zoom, x, y, rotate: false };
  }

  drawGround(ctx) {
    const { left, right, top, bottom } = this.visibleBounds();
    if (![left, right, top, bottom].every(Number.isFinite)) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    const step = 260;
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
        ctx.fillStyle = ((x / step + y / step) | 0) % 2 ? '#1a3020' : GRASS;
        ctx.fillRect(x, y, step, step);
      }
    }
    ctx.restore();
  }

  visibleBounds() {
    const halfW = this.width / 2 / this.zoom;
    const halfH = this.height / 2 / this.zoom;
    return {
      left: this.cameraPos.x - halfW,
      right: this.cameraPos.x + halfW,
      top: this.cameraPos.y - halfH,
      bottom: this.cameraPos.y + halfH,
    };
  }

  /** Devuelve el tramo de puntos visible para no dibujar el circuito entero. */
  visiblePoints() {
    const { left, right, top, bottom } = this.visibleBounds();
    const pts = this.track.points;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < left - 60 || p.x > right + 60 || p.y < top - 60 || p.y > bottom + 60) {
        if (out.length && out[out.length - 1] === i - 1) { out.push(i); continue; }
        if (out.length) out.push(i);
        continue;
      }
      out.push(i);
    }
    return out;
  }

  drawTrack(ctx, state) {
    const pts = this.track.points;
    const visible = this.visiblePoints();
    if (visible.length < 4) return;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Sombra de la cinta.
    this.fillRibbon(ctx, visible, 6, 'rgba(0, 0, 0, .45)');

    // Asfalto.
    this.fillRibbon(ctx, visible, 0, ASPHALT);

    // Franjas claras alternas para dar textura.
    ctx.strokeStyle = alpha(WHITE, 0.035);
    ctx.lineWidth = 1.4;
    for (let k = 0; k < visible.length; k += 14) this.strokeCentre(ctx, visible, k, k + 7);

    // Bordes blancos.
    ctx.strokeStyle = alpha(WHITE, 0.8);
    ctx.lineWidth = 1.1;
    this.strokeEdges(ctx, visible, 0);

    // Pianos.
    this.drawKerbs(ctx, visible);

    // Carril de boxes.
    this.drawPitLane(ctx);

    // Cebra de boxes.
    if (state && state.pitWindowOpen) this.drawPitBox(ctx, state);
  }

  /** Rellena la cinta de asfalto entre los dos bordes de la calzada. */
  fillRibbon(ctx, visible, pad, colour) {
    const pts = this.track.points;
    ctx.beginPath();
    let started = false;
    for (const i of visible) {
      const p = pts[i];
      if (!p) continue;
      const w = p.halfWidth + pad;
      const x = p.x + p.nx * w;
      const y = p.y + p.ny * w;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    for (let k = visible.length - 1; k >= 0; k--) {
      const p = pts[visible[k]];
      if (!p) continue;
      const w = p.halfWidth + pad;
      ctx.lineTo(p.x + p.nx * w, p.y + p.ny * w);
    }
    if (!started) return;
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }

  strokeCentre(ctx, visible, from = 0, to = visible.length) {
    const pts = this.track.points;
    ctx.beginPath();
    let started = false;
    for (let k = from; k < Math.min(to, visible.length); k++) {
      const i = visible[k];
      if (!Number.isFinite(i)) continue;
      const p = pts[i];
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  strokeEdges(ctx, visible, pad) {
    const pts = this.track.points;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      let started = false;
      for (const i of visible) {
        const p = pts[i];
        if (!p) continue;
        const w = p.halfWidth + pad;
        const x = p.x + p.nx * w * side;
        const y = p.y + p.ny * w * side;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawKerbs(ctx, visible) {
    const pts = this.track.points;
    for (const side of [-1, 1]) {
      let run = null;
      const flush = () => {
        if (!run || run.length < 2) { run = null; return; }
        ctx.beginPath();
        for (let k = 0; k < run.length; k++) {
          const { a, b } = run[k];
          if (k === 0) ctx.moveTo(a.x, a.y); else ctx.lineTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.strokeStyle = run[0].colour;
        ctx.lineWidth = run[0].width;
        ctx.stroke();
        run = null;
      };
      for (const i of visible) {
        const p = pts[i];
        if (!p || !p.kerb) { flush(); continue; }
        const w = p.halfWidth;
        const a = { x: p.x + p.nx * w * side, y: p.y + p.ny * w * side };
        const b = { x: p.x + p.nx * (w + 1.5) * side, y: p.y + p.ny * (w + 1.5) * side };
        const colour = side > 0 ? KERB_RED : KERB_BLUE;
        if (run && run[run.length - 1].colour !== colour) flush();
        run = run || { colour, width: 3.2 };
        run.push({ a, b });
      }
      flush();
    }
  }

  drawStartLine(ctx) {
    const p = this.track.points[this.track.startIdx] || this.track.points[0];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.dirY, p.dirX));
    const cells = 14;
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < cells; r++) {
        ctx.fillStyle = r % 2 ? '#101318' : WHITE;
        const w = (p.halfWidth * 2) / cells;
        ctx.fillRect(-1.4 + c * 1.4, -p.halfWidth + r * w, 1.4, w);
      }
    }
    ctx.restore();
  }

  drawDrsMarkers(ctx) {
    const pts = this.track.points;
    for (const zone of this.track.drsZones || []) {
      for (const idx of [zone.from, zone.to]) {
        const p = pts[idx];
        if (!p) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.dirY, p.dirX));
        ctx.fillStyle = 'rgba(34, 197, 94, .16)';
        ctx.fillRect(-0.5, -p.halfWidth, 1, p.halfWidth * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, .85)';
        ctx.fillRect(-0.7, -p.halfWidth, 1.4, 1.6);
        ctx.fillRect(-0.7, p.halfWidth - 1.6, 1.4, 1.6);
        ctx.restore();
      }
    }
  }

  drawPitLane(ctx) {
    const path = this.track.pit?.path;
    if (!path || !path.length) return;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.strokeStyle = '#3b4250';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = alpha('#f5d000', 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawPitBox(ctx, state) {
    const p = this.track.points[Math.round(this.track.startIdx * 0.06)] || this.track.points[0];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.dirY, p.dirX));
    ctx.fillStyle = 'rgba(245, 208, 0, .9)';
    ctx.fillRect(-8, -1, 3, 8);
    ctx.restore();
  }

  drawCars(ctx, state) {
    if (!state || !state.cars) return;
    const order = state.order || [];
    const sorted = [...state.cars].sort((a, b) => order.indexOf(a.driverId) - order.indexOf(b.driverId));
    // Los coches sinclassified se dibujan al final, apagados.
    for (const car of [...sorted.filter((c) => c.retired || c.eliminatedIn), ...sorted.filter((c) => !c.retired && !c.eliminatedIn)]) {
      if (!Number.isFinite(car.x) || !Number.isFinite(car.y)) continue;
      this.drawCar(ctx, car, state);
    }
  }

  drawCar(ctx, car, state) {
    const team = this.teamsById?.[car.teamId];
    const primary = teamColor(team);
    const secondary = teamSecondary(team);
    const ghost = car.retired || car.eliminatedIn;
    const width = 1.9;
    const length = 4.6;

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (ghost) ctx.globalAlpha = 0.35;

    // Sombra.
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    this.carPath(ctx, -length / 2, width / 2 + 0.25, length, width);
    ctx.fill();

    // Neumáticos.
    ctx.fillStyle = '#0e1015';
    ctx.fillRect(-length / 2 + 0.4, -width / 2 - 0.55, 1.5, 0.6);
    ctx.fillRect(-length / 2 + 0.4, width / 2 - 0.05, 1.5, 0.6);
    ctx.fillRect(length / 2 - 1.9, -width / 2 - 0.55, 1.5, 0.6);
    ctx.fillRect(length / 2 - 1.9, width / 2 - 0.05, 1.5, 0.6);

    // Monocasco con librea.
    this.carPath(ctx, -length / 2, -width / 2, length, width);
    const grad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    grad.addColorStop(0, primary);
    grad.addColorStop(0.5, secondary);
    grad.addColorStop(1, primary);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = alpha('#000000', 0.55);
    ctx.lineWidth = 0.25;
    ctx.stroke();

    // Alerón y morro.
    ctx.fillStyle = primary;
    ctx.fillRect(-length / 2 - 0.5, -width / 2, 0.5, width);
    ctx.fillRect(length / 2 - 0.4, -width / 2 - 0.1, 0.4, width + 0.2);

    // Copiloto.
    ctx.fillStyle = CARBON;
    ctx.beginPath();
    ctx.arc(-0.2, 0, 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Destello del DRS.
    if (car.drsOpen && !ghost) {
      ctx.fillStyle = 'rgba(34, 197, 94, .9)';
      ctx.fillRect(length / 2 - 0.2, -0.4, 0.4, 0.8);
    }

    // Etiqueta del jugador.
    if (car.isPlayer) {
      ctx.rotate(-car.angle);
      ctx.fillStyle = readableOn(primary);
      ctx.font = 'bold 2.6px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TÚ', 0, -4.2);
    }
    ctx.restore();
  }

  carPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + 0.35);
    ctx.lineTo(x + w, y + h - 0.35);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.35,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.75,
    );
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, .45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  dispose() {
    this.staticLayer = null;
    this.track = null;
  }
}
