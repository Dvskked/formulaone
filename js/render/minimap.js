// Minimap: reutiliza el trazado SVG que genera track.js y añade los coches.

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.points = null;
    this.scale = 1;
    this.offX = 0;
    this.offY = 0;
  }

  setTrack(track) {
    this.track = track;
    this.points = parsePath(track.mapPath);
    this.layout();
  }

  layout() {
    if (!this.points) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 8;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    this.scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    this.offX = pad + (w - pad * 2 - spanX * this.scale) / 2 - minX * this.scale;
    this.offY = pad + (h - pad * 2 - spanY * this.scale) / 2 - minY * this.scale;
  }

  project(x, y) {
    return { x: x * this.scale + this.offX, y: y * this.scale + this.offY };
  }

  draw(state, { highlightSectors = null } = {}) {
    if (!this.track) return;
    if (!this.points || !this.width) this.layout();
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.beginPath();
    for (let i = 0; i < this.points.length; i++) {
      const p = this.project(this.points[i].x, this.points[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(238, 241, 247, .22)';
    ctx.lineWidth = 3.4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(5, 6, 10, .9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (!state) { ctx.restore(); return; }

    if (highlightSectors) {
      const pts = this.track.points;
      ctx.strokeStyle = 'rgba(245, 208, 0, .9)';
      ctx.lineWidth = 2.4;
      for (const s of [0, 1, 2]) {
        if (highlightSectors[s] === false) continue;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const seg = s === 0 ? i < pts.length / 3 : s === 1 ? i < (pts.length * 2) / 3 : true;
          if (!seg) continue;
          const p = this.project(pts[i].x, pts[i].y);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }

    // Coches: el jugador encima y con anillo.
    const cars = state.cars || [];
    for (const car of cars) {
      if (car.retired || car.eliminatedIn || !Number.isFinite(car.x)) continue;
      const p = this.project(car.x, car.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, car.isPlayer ? 3.4 : 1.9, 0, Math.PI * 2);
      ctx.fillStyle = car.color || '#e8112d';
      ctx.fill();
      if (car.isPlayer) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** Convierte un «path» SVG simple (M/L) en una lista de puntos. */
export function parsePath(d) {
  if (!d) return [];
  const out = [];
  const tokens = d.match(/[ML]|-?\d+(\.\d+)?/gi) || [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === 'M' || cmd === 'L') {
      const x = parseFloat(tokens[i + 1]);
      const y = parseFloat(tokens[i + 2]);
      if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
      i += 3;
    } else {
      i += 1;
    }
  }
  return out;
}
