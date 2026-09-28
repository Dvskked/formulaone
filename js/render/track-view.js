// Renderizador de la vista superior del circuito: asfalto, pianos, línea de meta,
// zona de DRS, boxes y coches. Trabaja en coordenadas del circuito y se
// transforma al lienzo con una cámara que sigue al jugador.

import {
  ASPHALT, ASPHALT_DARK, CARBON, GRASS, KERB_BLUE, KERB_RED, WHITE,
  alpha, readableOn, teamColor, teamSecondary,
} from './palette.js';

const CAMERAS = {
  1: { zoom: 3.6, name: 'Cockpit' },
  2: { zoom: 2.4, name: 'Cámara alta' },
  3: { zoom: 1.15, name: 'Cenital' },
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
    /* Se mira más lejos cuanto más rápido va el coche, y en el cockpit la
       cámara va pegada al morro para que la pista se vea ancha */
    const ahead = (this.camera === 1 ? 6 : 18) + p.speed * 0.5;
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

    // Escapatorias de fuera de pista: grava, asfalto o hierba.
    this.drawRunoff(ctx, visible);

    // Tribunas y estructuras al borde del circuito.
    this.drawStands(ctx, visible);

    // Pórtico de salida con el semáforo.
    this.drawGantry(ctx, state);

    // Carril de boxes.
    this.drawPitLane(ctx);

    // Cebra de boxes.
    if (state && state.pitWindowOpen) this.drawPitBox(ctx, state);
  }

  /**
   * Franja de escapatoria a ambos lados del asfalto: grava en las curvas lentas
   * y asfalto en las rápidas, como en los trazados reales. Se dibuja por
   * tramos porque el material cambia punto a punto.
   */
  drawRunoff(ctx, visible) {
    const pts = this.track.points;
    const HARD = 7.5;
    const SOFT = 15;
    const materials = {
      gravel: 'rgba(150, 132, 98, .9)',
      asphalt: 'rgba(52, 56, 66, .9)',
      grass: 'rgba(46, 74, 50, .9)',
    };
    for (const side of [-1, 1]) {
      /* Banda exterior, siempre verde: separa la pista del entorno */
      this.runoffBand(ctx, visible, pts, side, SOFT, HARD, () => materials.grass);
      /* Banda interior de escapatoria, por material */
      let run = null;
      const flush = () => {
        if (!run || run.points.length < 2) { run = null; return; }
        ctx.beginPath();
        const ptsOfRun = run.points;
        for (let k = 0; k < ptsOfRun.length; k++) {
          const { a, b } = ptsOfRun[k];
          if (k === 0) ctx.moveTo(a.x, a.y); else ctx.lineTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.lineWidth = HARD;
        ctx.strokeStyle = run.colour;
        ctx.stroke();
        run = null;
      };
      for (const i of visible) {
        const p = pts[i];
        const material = p?.runoff || 'grass';
        if (!p) { flush(); continue; }
        if (run && run.material !== material) flush();
        if (!run) run = { material, colour: materials[material] || materials.grass, points: [] };
        run.points.push({
          a: { x: p.x + p.nx * HARD * side, y: p.y + p.ny * HARD * side },
          b: { x: p.x + p.nx * p.halfWidth * side, y: p.y + p.ny * p.halfWidth * side },
        });
      }
      flush();
    }
  }

  /** Banda continua entre dos distancias del borde del asfalto. */
  runoffBand(ctx, visible, pts, side, from, to, colourFn) {
    ctx.beginPath();
    let started = false;
    for (const i of visible) {
      const p = pts[i];
      if (!p) continue;
      const x = p.x + p.nx * (p.halfWidth + from) * side;
      const y = p.y + p.ny * (p.halfWidth + from) * side;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    for (let k = visible.length - 1; k >= 0; k--) {
      const p = pts[visible[k]];
      if (!p) continue;
      ctx.lineTo(p.x + p.nx * (p.halfWidth + to) * side, p.y + p.ny * (p.halfWidth + to) * side);
    }
    if (!started) return;
    ctx.closePath();
    ctx.fillStyle = colourFn();
    ctx.fill();
  }

  /** Tribunas y gradas a lo largo del trazado, para que la pista no quede vacía. */
  drawStands(ctx, visible) {
    const pts = this.track.points;
    for (const side of [-1, 1]) {
      for (let k = 0; k < visible.length; k += 26) {
        const p = pts[visible[k]];
        if (!p) continue;
        const off = p.halfWidth + 16;
        ctx.save();
        ctx.translate(p.x + p.nx * off * side, p.y + p.ny * off * side);
        ctx.rotate(Math.atan2(p.dirY, p.dirX));
        /* Grada oscura con las filas de asientos */
        ctx.fillStyle = 'rgba(18, 24, 34, .92)';
        ctx.fillRect(-7, -2.5, 14, 5);
        ctx.fillStyle = 'rgba(40, 52, 70, .9)';
        for (let row = -1.6; row <= 1.6; row += 1.6) ctx.fillRect(-6.5, row - 0.5, 13, 1);
        ctx.restore();
      }
    }
  }

  /** Pórtico de salida sobre la línea de meta, con las cinco luces. */
  drawGantry(ctx, state) {
    const p = this.track.points[this.track.startIdx] || this.track.points[0];
    if (!p) return;
    const lit = state?.phase === 'countdown' ? state.lights || 0 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.dirY, p.dirX));
    const span = p.halfWidth + 3;
    /* Pilares */
    ctx.fillStyle = '#2b3446';
    ctx.fillRect(-1.2, -span, 2.4, 1.6);
    ctx.fillRect(-1.2, span - 1.6, 2.4, 1.6);
    /* Travesaño */
    ctx.fillStyle = '#39445c';
    ctx.fillRect(-1.6, -span, 3.2, span * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, .25)';
    ctx.fillRect(-1.6, -span, 1, span * 2);
    /* Cinco luces del semáforo */
    for (let i = 0; i < 5; i++) {
      const y = -span * 0.72 + i * (span * 1.44 / 4);
      ctx.beginPath();
      ctx.arc(0, y, 1.05, 0, Math.PI * 2);
      ctx.fillStyle = i < lit ? '#ef4444' : 'rgba(24, 30, 42, .9)';
      ctx.fill();
      if (i < lit) {
        ctx.strokeStyle = 'rgba(252, 165, 165, .9)';
        ctx.lineWidth = 0.28;
        ctx.stroke();
      }
    }
    ctx.restore();
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
        if (!run || run.segs.length < 2) { run = null; return; }
        ctx.beginPath();
        for (let k = 0; k < run.segs.length; k++) {
          const { a, b } = run.segs[k];
          if (k === 0) ctx.moveTo(a.x, a.y); else ctx.lineTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.strokeStyle = run.colour;
        ctx.lineWidth = run.width;
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
        if (run && run.colour !== colour) flush();
        if (!run) run = { colour, width: 3.2, segs: [] };
        run.segs.push({ a, b });
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
    const rank = new Map(order.map((c, i) => [c, i]));
    const sorted = state.cars.slice().sort((a, b) => {
      /* state.order son objetos de coche, no ids: se ordena por posición real */
      const pa = rank.has(a) ? rank.get(a) : 999;
      const pb = rank.has(b) ? rank.get(b) : 999;
      return pa - pb;
    });
    // Los coches sin clasificar se dibujan al final, apagados.
    for (const car of [...sorted.filter((c) => c.retired || c.eliminatedIn), ...sorted.filter((c) => !c.retired && !c.eliminatedIn)]) {
      if (!Number.isFinite(car.x) || !Number.isFinite(car.y)) continue;
      this.drawCar(ctx, car, state);
    }
  }

  /**
   * Monoplaza de F1 visto desde arriba: morro, pontones, alerones, casco con
   * halo y el dorsal del piloto. Medidas reales en metros (4,6 x 2,0).
   */
  drawCar(ctx, car, state) {
    const team = this.teamsById?.[car.teamId];
    const primary = teamColor(team);
    const secondary = teamSecondary(team);
    const ghost = car.retired || car.eliminatedIn;
    const W = 2.0;
    const L = 4.6;
    const nose = L / 2;

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (ghost) ctx.globalAlpha = 0.35;

    // Sombra proyectada.
    ctx.fillStyle = 'rgba(0, 0, 0, .5)';
    this.bodyPath(ctx, -L / 2, -W / 2, L, W);
    ctx.fill();

    // Neumáticos traseros y delanteros, con banda de rodadura.
    ctx.fillStyle = '#0b0d11';
    for (const [x, w] of [[-L / 2 + 0.25, 1.55], [L / 2 - 1.8, 1.4]]) {
      ctx.fillRect(x, -W / 2 - 0.5, w, 0.5);
      ctx.fillRect(x, W / 2, w, 0.5);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, .08)';
    for (const [x, w] of [[-L / 2 + 0.35, 1.35], [L / 2 - 1.7, 1.2]]) {
      ctx.fillRect(x, -W / 2 - 0.42, w, 0.16);
      ctx.fillRect(x, W / 2 + 0.26, w, 0.16);
    }

    // Monocasco con librea del equipo.
    this.bodyPath(ctx, -L / 2, -W / 2, L, W);
    const grad = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
    grad.addColorStop(0, secondary);
    grad.addColorStop(0.45, primary);
    grad.addColorStop(1, secondary);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = alpha('#000000', 0.6);
    ctx.lineWidth = 0.18;
    ctx.stroke();

    // Morro: punta estrecha delante de los pontones.
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(nose - 0.1, -0.5);
    ctx.lineTo(nose + 0.95, -0.16);
    ctx.lineTo(nose + 0.95, 0.16);
    ctx.lineTo(nose - 0.1, 0.5);
    ctx.closePath();
    ctx.fill();

    // Franjas de la librea sobre el morro y el(engine cover).
    ctx.fillStyle = secondary;
    ctx.fillRect(nose - 0.3, -0.22, 1.1, 0.44);
    ctx.fillStyle = alpha('#ffffff', 0.35);
    ctx.fillRect(-L / 2 + 0.9, -0.1, 2.6, 0.2);

    // Alerón trasero, en doszamonas con el plano principal.
    ctx.fillStyle = secondary;
    ctx.fillRect(-L / 2 - 0.62, -W / 2 + 0.05, 0.62, W - 0.1);
    ctx.fillStyle = primary;
    ctx.fillRect(-L / 2 - 1.05, -W / 2 - 0.12, 0.45, W + 0.24);
    ctx.fillStyle = alpha('#000000', 0.35);
    ctx.fillRect(-L / 2 - 1.05, -0.1, 0.45, 0.2);

    // Alerón delantero.
    ctx.fillStyle = secondary;
    ctx.fillRect(nose + 0.55, -0.9, 0.5, 1.8);

    // Airbox y cubierta del motor.
    ctx.fillStyle = alpha('#000000', 0.35);
    this.bodyPath(ctx, -L / 2 + 0.1, -0.36, L - 0.6, 0.72);
    ctx.fill();

    // Casco del piloto y halo.
    ctx.fillStyle = readableOn(primary);
    ctx.beginPath();
    ctx.arc(0.1, 0, 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CARBON;
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.arc(0.05, 0, 0.62, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.55, 0);
    ctx.lineTo(0.68, 0);
    ctx.stroke();

    // Dorsal en el morro, en el color que contraste con la librea.
    if (car.number != null) {
      ctx.fillStyle = readableOn(primary);
      ctx.font = 'bold 1.5px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(nose + 0.35, 0);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(car.number), 0, 0);
      ctx.restore();
    }

    // Destello del DRS.
    if (car.drsOpen && !ghost) {
      ctx.fillStyle = 'rgba(34, 197, 94, .9)';
      ctx.fillRect(nose - 0.3, -0.3, 0.22, 0.6);
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

  /** Silueta del monoplaza: morro estrecho y pontones anchos. */
  bodyPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.62, y);
    ctx.lineTo(x + w, y + h * 0.22);
    ctx.lineTo(x + w, y + h * 0.78);
    ctx.lineTo(x + w * 0.62, y + h);
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
