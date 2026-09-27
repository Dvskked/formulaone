// Fondo animado del menú: trazo de circuito difuminado, líneas de velocidad
// y partículas. Usa requestAnimationFrame y se detiene al ocultar el menú.

export class MenuBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.t = 0;
    this.streaks = [];
    this.dpr = 1;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.seedStreaks();
  }

  seedStreaks() {
    const count = Math.round(Math.min(46, (this.w * this.h) / 26000));
    this.streaks = Array.from({ length: count }, () => this.newStreak(true));
  }

  newStreak(anywhere) {
    const angle = -0.42;
    const speed = 240 + Math.random() * 620;
    return {
      x: anywhere ? Math.random() * this.w * 1.4 - this.w * 0.2 : -60 - Math.random() * 300,
      y: Math.random() * this.h,
      len: 70 + Math.random() * 240,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      ttl: 1.6 + Math.random() * 2.4,
      w: 1 + Math.random() * 2.2,
      hue: Math.random() < 0.14 ? 348 : 220,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  step(dt) {
    this.t += dt;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const bg = ctx.createLinearGradient(0, 0, this.w, this.h);
    bg.addColorStop(0, '#070912');
    bg.addColorStop(0.55, '#0a0d18');
    bg.addColorStop(1, '#05060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawGlow(ctx);
    this.drawStreaks(ctx, dt);
    this.drawHorizon(ctx);
    ctx.restore();
  }

  drawGlow(ctx) {
    const cx = this.w * (0.5 + 0.16 * Math.sin(this.t * 0.11));
    const cy = this.h * 0.42;
    const r = Math.max(this.w, this.h) * 0.55;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(232, 17, 45, .16)');
    g.addColorStop(0.45, 'rgba(21, 96, 189, .07)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawHorizon(ctx) {
    const y = this.h * 0.62;
    ctx.strokeStyle = 'rgba(238, 241, 247, .05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 12; i++) {
      const p = i / 12;
      const yy = y + (this.h - y) * p * p;
      ctx.beginPath();
      ctx.moveTo(this.w * 0.5 - this.w * p * 0.9, yy);
      ctx.lineTo(this.w * 0.5 + this.w * p * 0.9, yy);
      ctx.stroke();
    }
  }

  drawStreaks(ctx, dt) {
    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life += dt;
      if (s.x - s.len > this.w || s.life > s.ttl || s.y > this.h + 80) {
        this.streaks[i] = this.newStreak(false);
        continue;
      }
      const fade = Math.min(1, s.life * 3) * Math.min(1, (s.ttl - s.life) * 1.4);
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * 0.5);
      grad.addColorStop(0, `hsla(${s.hue}, 90%, 62%, ${0.5 * fade})`);
      grad.addColorStop(1, `hsla(${s.hue}, 90%, 62%, 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len, s.y - s.len * 0.5);
      ctx.stroke();
    }
  }
}
