/* FORMULA 1: PREDESTINATO — paquete autogenerado por build.mjs. No editar a mano. */
(function () {
'use strict';
var __registry = {};
var __cache = {};
function __req(id) {
  if (__cache[id]) return __cache[id];
  var exports = (__cache[id] = {});
  var factory = __registry[id];
  if (!factory) throw new Error('Modulo no encontrado: ' + id);
  factory(exports, __req);
  return exports;
}
function __lazy(id) { return Promise.resolve().then(function () { return __req(id); }); }
__registry["js/core/audio.js"] = function (__x, __req) {
// Audio sintetizado con Web Audio API: motor, ERS, neumáticos, público, música y efectos.
// No usa archivos externos: todo se genera en tiempo real.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this.volumes = { engine: 0.75, sfx: 1, music: 0.45, crowd: 0.5 };
    this.engineOn = false;
    this.nodes = null;
    this.crowdNodes = null;
    this.rainNodes = null;
    this.musicNodes = null;
    this._lastSfx = Object.create(null);
    this._pending = null;
  }

  /* ─────────────── arranque (requiere gesto del usuario) ─────────────── */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ready;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return false;
    }
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.busEngine = ctx.createGain();
    this.busEngine.gain.value = this.volumes.engine;
    this.busEngine.connect(this.master);

    this.busSfx = ctx.createGain();
    this.busSfx.gain.value = this.volumes.sfx;
    this.busSfx.connect(this.master);

    this.busCrowd = ctx.createGain();
    this.busCrowd.gain.value = 0;
    this.busCrowd.connect(this.master);

    this.busMusic = ctx.createGain();
    this.busMusic.gain.value = 0;
    this.busMusic.connect(this.master);

    this.noiseBuffer = this._makeNoise(2.2);
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (this._pending) {
      const fn = this._pending;
      this._pending = null;
      fn();
    }
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.08);
    }
    if (on) this.resume();
  }

  setVolumes(v = {}) {
    Object.assign(this.volumes, v);
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (this.busEngine) this.busEngine.gain.setTargetAtTime(this.volumes.engine, t, 0.1);
    if (this.busSfx) this.busSfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.1);
    if (this.busMusic) this.busMusic.gain.setTargetAtTime(this.volumes.music * (this.musicNodes ? 1 : 0), t, 0.2);
    if (this.busCrowd) this.busCrowd.gain.setTargetAtTime(this.volumes.crowd * (this.crowdNodes ? this.crowdNodes.level : 0), t, 0.3);
  }

  _makeNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.86 * last + 0.14 * white;
      d[i] = white * 0.7 + last * 0.6;
    }
    return buf;
  }

  _noiseSource(loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  /* ─────────────────────────── MOTOR ─────────────────────────── */
  startEngine(profile = {}) {
    if (!this.ready) {
      this._pending = () => this.startEngine(profile);
      return;
    }
    if (this.engineOn) this.stopEngine();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.busEngine);

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.4) * 0.85;
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    shaper.connect(out);

    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 2400;
    body.Q.value = 0.9;
    body.connect(shaper);

    const oscA = ctx.createOscillator();
    oscA.type = profile.sawtooth || 'sawtooth';
    const oscB = ctx.createOscillator();
    oscB.type = 'square';
    const oscC = ctx.createOscillator();
    oscC.type = 'sawtooth';

    const gA = ctx.createGain();
    gA.gain.value = 0.5;
    const gB = ctx.createGain();
    gB.gain.value = 0.24;
    const gC = ctx.createGain();
    gC.gain.value = 0.3;
    oscA.connect(gA).connect(body);
    oscB.connect(gB).connect(body);
    oscC.connect(gC).connect(body);

    /* capa de admisión: ruido filtrado que sigue a las rpm */
    const intake = this._noiseSource();
    const intakeFilter = ctx.createBiquadFilter();
    intakeFilter.type = 'bandpass';
    intakeFilter.frequency.value = 900;
    intakeFilter.Q.value = 0.7;
    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0.0;
    intake.connect(intakeFilter).connect(intakeGain).connect(shaper);

    /* capaurbo / ERS: silbido agudo del despliegue eléctrico */
    const ers = ctx.createOscillator();
    ers.type = 'triangle';
    const ersGain = ctx.createGain();
    ersGain.gain.value = 0.0001;
    const ersFilter = ctx.createBiquadFilter();
    ersFilter.type = 'bandpass';
    ersFilter.frequency.value = 2600;
    ersFilter.Q.value = 5;
    ers.connect(ersFilter).connect(ersGain).connect(out);

    /* windscreen / flujo de aire */
    const wind = this._noiseSource();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'highpass';
    windFilter.frequency.value = 1400;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.0001;
    wind.connect(windFilter).connect(windGain).connect(out);

    const baseFreq = clamp(profile.baseFreq || 46, 24, 120);
    const harmonics = profile.harmonics || [1, 2, 3.02, 4.1];

    oscA.start(now);
    oscB.start(now);
    oscC.start(now);
    intake.start(now);
    ers.start(now);
    wind.start(now);
    out.gain.setTargetAtTime(0.28, now, 0.25);

    this.nodes = {
      out,
      shaper,
      body,
      oscA,
      oscB,
      oscC,
      gA,
      gB,
      gC,
      intake,
      intakeGain,
      ers,
      ersGain,
      wind,
      windGain,
      baseFreq,
      harmonics,
      profile,
      dead: false,
    };
    this.engineOn = true;
  }

  /**
   * @param {{rpm:number, throttle:number, speed:number, gear:number, ers:number,
   *          drs:boolean, offTrack:boolean, kerb:number, load:number}} s
   */
  updateEngine(s = {}) {
    if (!this.ready || !this.engineOn || !this.nodes || this.nodes.dead) return;
    const n = this.nodes;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const smooth = 0.045;

    const rpm = clamp(s.rpm || 900, 400, 15500);
    const base = n.baseFreq;
    const thr = clamp(s.throttle ?? 0.5, 0, 1);
    const speed = clamp(s.speed || 0, 0, 100);
    const load = clamp(s.load ?? thr, 0, 1);
    const f = (base * rpm) / 1000;

    n.oscA.frequency.setTargetAtTime(f * n.harmonics[0], now, smooth);
    n.oscB.frequency.setTargetAtTime(f * n.harmonics[1] * 0.5, now, smooth);
    n.oscC.frequency.setTargetAtTime(f * (n.harmonics[2] || 3), now, smooth);
    n.gA.gain.setTargetAtTime(0.34 + 0.34 * load, now, smooth);
    n.gB.gain.setTargetAtTime(0.1 + 0.2 * thr, now, smooth);
    n.gC.gain.setTargetAtTime(0.14 + 0.26 * load, now, smooth);

    const cut = s.offTrack ? 0.55 : 1;
    n.body.frequency.setTargetAtTime((900 + thr * 3200 + (rpm / 15000) * 2600) * cut, now, 0.06);
    n.intakeFilter.frequency.setTargetAtTime(500 + f * 3.2, now, smooth);
    n.intakeGain.gain.setTargetAtTime((0.05 + 0.2 * thr) * (s.offTrack ? 1.9 : 1), now, smooth);

    const ersLevel = clamp(s.ers ?? 0, 0, 1);
    n.ers.frequency.setTargetAtTime(1800 + ersLevel * 3400, now, 0.08);
    n.ersGain.gain.setTargetAtTime(0.004 + ersLevel * 0.03 * (0.3 + 0.7 * thr), now, 0.08);

    n.windFilter.frequency.setTargetAtTime(900 + speed * 55, now, 0.1);
    n.windGain.gain.setTargetAtTime(clamp((speed - 12) * 0.0055, 0, 0.16), now, 0.12);

    const gainTarget = 0.2 + 0.2 * thr + 0.1 * (rpm / 15000) + (s.drs ? 0.05 : 0);
    n.out.gain.setTargetAtTime(gainTarget, now, 0.08);
  }

  stopEngine() {
    if (!this.nodes || !this.ready) {
      this.engineOn = false;
      return;
    }
    const n = this.nodes;
    const now = this.ctx.currentTime;
    n.out.gain.cancelScheduledValues(now);
    n.out.gain.setTargetAtTime(0.0001, now, 0.12);
    const stopAt = now + 0.6;
    for (const node of [n.oscA, n.oscB, n.oscC, n.intake, n.ers, n.wind]) {
      try {
        node.stop(stopAt);
      } catch {
        /* ya parado */
      }
    }
    setTimeout(() => {
      n.dead = true;
    }, 1400);
    this.nodes = null;
    this.engineOn = false;
  }

  /* ─────────────────────── NEUMÁTICOS ─────────────────────── */
  setTireScreech(level) {
    if (!this.ready) return;
    if (!this._tire) {
      const src = this._noiseSource();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2100;
      filter.Q.value = 3.4;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter).connect(gain).connect(this.busSfx);
      src.start();
      this._tire = { src, filter, gain };
    }
    const l = clamp(level, 0, 1);
    this._tire.gain.gain.setTargetAtTime(l * 0.16, this.ctx.currentTime, 0.06);
    this._tire.filter.frequency.setTargetAtTime(1500 + l * 2400, this.ctx.currentTime, 0.1);
  }

  setSurface(level) {
    if (!this.ready) return;
    if (!this._surface) {
      const src = this._noiseSource();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter).connect(gain).connect(this.busSfx);
      src.start();
      this._surface = { src, filter, gain };
    }
    const l = clamp(level, 0, 1);
    this._surface.gain.gain.setTargetAtTime(l * 0.1, this.ctx.currentTime, 0.08);
  }

  stopLoops() {
    this.setTireScreech(0);
    this.setSurface(0);
  }

  /* ───────────────────────── PÚBLICO ───────────────────────── */
  setCrowd(level) {
    if (!this.ready) return;
    const l = clamp(level, 0, 1);
    if (l <= 0.001) {
      if (this.crowdNodes) {
        this.busCrowd.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
        const nodes = this.crowdNodes;
        setTimeout(() => {
          try {
            nodes.src.stop();
          } catch {
            /* ignora */
          }
        }, 1600);
        this.crowdNodes = null;
      }
      return;
    }
    if (!this.crowdNodes) {
      const src = this._noiseSource();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 620;
      filter.Q.value = 0.55;
      const gain = this.ctx.createGain();
      gain.gain.value = 1;
      src.connect(filter).connect(gain).connect(this.busCrowd);
      src.start();
      this.crowdNodes = { src, filter, gain, level: 0.3 };
    }
    this.crowdNodes.level = l;
    this.crowdNodes.filter.frequency.setTargetAtTime(420 + l * 900, this.ctx.currentTime, 0.5);
    this.busCrowd.gain.setTargetAtTime(this.volumes.crowd * (0.25 + l * 0.85), this.ctx.currentTime, 0.6);
  }

  setRain(level) {
    if (!this.ready) return;
    const l = clamp(level, 0, 1);
    if (l <= 0.001) {
      if (this.rainNodes) {
        this.rainNodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
        const nodes = this.rainNodes;
        setTimeout(() => {
          try {
            nodes.src.stop();
          } catch {
            /* ignora */
          }
        }, 1200);
        this.rainNodes = null;
      }
      return;
    }
    if (!this.rainNodes) {
      const src = this._noiseSource();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2600;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter).connect(gain).connect(this.busSfx);
      src.start();
      this.rainNodes = { src, filter, gain };
    }
    this.rainNodes.gain.gain.setTargetAtTime(l * 0.09, this.ctx.currentTime, 0.5);
  }

  /* ────────────────────────── MÚSICA ────────────────────────── */
  startMusic(mood = 'menu') {
    if (!this.ready) {
      this._pending = () => this.startMusic(mood);
      return;
    }
    this.stopMusic();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bpm = mood === 'race' ? 138 : mood === 'hub' ? 104 : 92;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood === 'menu' ? 1500 : 2400;
    master.connect(filter).connect(this.busMusic);
    master.gain.setTargetAtTime(0.5, now, 1.2);
    this.busMusic.gain.setTargetAtTime(this.volumes.music, now, 0.8);

    const scale = mood === 'menu' ? [0, 3, 5, 7, 10] : [0, 2, 3, 7, 8, 10];
    const root = mood === 'menu' ? 110 : mood === 'race' ? 98 : 123.47;
    const oscs = [];
    const voices = mood === 'menu' ? 4 : 6;
    for (let i = 0; i < voices; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : i % 2 ? 'square' : 'triangle';
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(master);
      osc.start();
      oscs.push({ osc, g });
    }

    const stepDur = 60 / bpm / 2;
    let step = 0;
    const bassPattern = [0, 0, 7, 0, 5, 0, 3, 0];
    const timer = setInterval(() => {
      if (!this.musicNodes) return;
      const t = ctx.currentTime + 0.05;
      const semis = bassPattern[step % bassPattern.length];
      const note = root * Math.pow(2, semis / 12);
      const lead = root * 2 * Math.pow(2, scale[(step * 3) % scale.length] / 12);
      for (let i = 0; i < oscs.length; i++) {
        const { osc, g } = oscs[i];
        if (i === 0) {
          osc.frequency.setValueAtTime(note, t);
          g.gain.setTargetAtTime(0.22, t, 0.02);
        } else if (i === 1) {
          osc.frequency.setValueAtTime(note * 1.5, t);
          g.gain.setTargetAtTime(step % 4 === 0 ? 0.13 : 0.04, t, 0.03);
        } else if (i % 3 === 0) {
          osc.frequency.setValueAtTime(lead, t);
          g.gain.setTargetAtTime(step % 2 === 0 ? 0.09 : 0.02, t, 0.04);
        } else {
          osc.frequency.setValueAtTime(lead * 1.001, t);
          g.gain.setTargetAtTime(0.035, t, 0.05);
        }
      }
      step++;
    }, stepDur * 1000);

    this.musicNodes = { master, oscs, timer, mood };
  }

  stopMusic() {
    if (!this.musicNodes) return;
    const { master, oscs, timer } = this.musicNodes;
    clearInterval(timer);
    const now = this.ctx.currentTime;
    master.gain.setTargetAtTime(0.0001, now, 0.5);
    for (const { osc } of oscs) {
      try {
        osc.stop(now + 2.2);
      } catch {
        /* ignora */
      }
    }
    this.musicNodes = null;
  }

  /* ────────────────────────── SFX ────────────────────────── */
  sfx(name, opts = {}) {
    if (!this.enabled) return;
    if (!this.ready) {
      this._pending = () => this.sfx(name, opts);
      return;
    }
    const now = this.ctx.currentTime;
    /* limitador para evitar saturación en eventos simultáneos */
    const last = this._lastSfx[name] || 0;
    if (now - last < (opts.cooldown ?? 0.03)) return;
    this._lastSfx[name] = now;

    const bus = this.busSfx;
    const tone = (freq, dur, type = 'sine', gain = 0.2, slideTo = null, delay = 0) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      const t = now + delay;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };

    const noiseBurst = (dur, freq, q, gain = 0.2, type = 'bandpass', delay = 0) => {
      const src = this._noiseSource(false);
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.Q.value = q;
      const g = this.ctx.createGain();
      const t = now + delay;
      filter.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter).connect(g).connect(bus);
      src.start(t);
      src.stop(t + dur + 0.05);
    };

    switch (name) {
      case 'click':
        tone(880, 0.05, 'square', 0.06, 660);
        break;
      case 'hover':
        tone(1200, 0.03, 'sine', 0.03);
        break;
      case 'back':
        tone(520, 0.09, 'triangle', 0.07, 300);
        break;
      case 'confirm':
        tone(523.25, 0.09, 'triangle', 0.1);
        tone(783.99, 0.12, 'triangle', 0.09, null, 0.07);
        break;
      case 'error':
        tone(180, 0.16, 'sawtooth', 0.09, 110);
        break;
      case 'whoosh':
        noiseBurst(0.32, 700, 0.8, 0.12, 'bandpass');
        break;
      case 'drs':
        noiseBurst(0.14, 2600, 2.2, 0.1, 'bandpass');
        tone(1400, 0.12, 'square', 0.04, 2400);
        break;
      case 'drsClose':
        tone(900, 0.08, 'square', 0.04, 500);
        break;
      case 'ersBoost':
        tone(220, 0.4, 'sawtooth', 0.07, 1500);
        break;
      case 'kerb':
        noiseBurst(0.09, 180, 1.2, 0.16, 'lowpass');
        break;
      case 'bump':
        noiseBurst(0.16, 320, 0.9, 0.2, 'lowpass');
        tone(90, 0.16, 'sine', 0.14, 55);
        break;
      case 'crash':
        noiseBurst(0.6, 900, 0.4, 0.3, 'bandpass');
        noiseBurst(0.9, 160, 0.7, 0.24, 'lowpass', 0.02);
        tone(70, 0.5, 'sine', 0.18, 40);
        break;
      case 'gear':
        tone(300 + Math.random() * 40, 0.04, 'square', 0.045, 210);
        break;
      case 'beep':
        tone(1000, 0.1, 'sine', 0.1);
        break;
      case 'beepGo':
        tone(1000, 0.14, 'sine', 0.12);
        tone(1500, 0.3, 'sine', 0.12, null, 0.16);
        break;
      case 'lights':
        for (let i = 0; i < 5; i++) tone(760, 0.11, 'square', 0.11, null, i * 0.32);
        break;
      case 'penalty':
        tone(420, 0.12, 'square', 0.1, 300);
        tone(300, 0.16, 'square', 0.1, 220, 0.14);
        break;
      case 'pit':
        noiseBurst(0.2, 900, 1.4, 0.14, 'bandpass');
        tone(120, 0.25, 'sawtooth', 0.07, 90);
        break;
      case 'pitStop':
        tone(90, 0.5, 'sawtooth', 0.1, 130);
        noiseBurst(0.5, 700, 1.1, 0.1, 'bandpass', 0.1);
        tone(1600, 0.09, 'sine', 0.08, null, 0.62);
        break;
      case 'lap':
        tone(1200, 0.08, 'sine', 0.08);
        break;
      case 'bestLap':
        tone(784, 0.1, 'triangle', 0.1);
        tone(1046, 0.1, 'triangle', 0.1, null, 0.1);
        tone(1568, 0.18, 'triangle', 0.1, null, 0.2);
        break;
      case 'finish':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, null, i * 0.13));
        break;
      case 'crowdCheer':
        noiseBurst(1.5, 900, 0.4, 0.2, 'bandpass');
        noiseBurst(1.2, 1500, 0.5, 0.12, 'bandpass', 0.12);
        break;
      case 'news':
        tone(660, 0.07, 'sine', 0.07);
        tone(990, 0.1, 'sine', 0.06, null, 0.06);
        break;
      case 'mail':
        tone(523, 0.09, 'sine', 0.08);
        tone(659, 0.09, 'sine', 0.07, null, 0.09);
        tone(880, 0.16, 'sine', 0.07, null, 0.18);
        break;
      case 'levelUp':
        [523, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, null, i * 0.09));
        break;
      case 'wind':
        noiseBurst(1.1, 480, 0.5, 0.12, 'bandpass');
        break;
      default:
        tone(440, 0.06, 'sine', 0.05);
    }
  }

  /** Motor turbo de las introductions de pantalla. */
  engineSweep(duration = 1.6) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const src = this._noiseSource(false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + duration * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(g).connect(this.busSfx);
    src.start(now);
    src.stop(now + duration + 0.1);
  }

  shutdown() {
    this.stopEngine();
    this.stopMusic();
    this.stopLoops();
    this.setCrowd(0);
    this.setRain(0);
  }
}

const audio = new AudioEngine();

function audioBoot() {
  const kick = () => {
    audio.init();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
    window.removeEventListener('touchstart', kick);
  };
  window.addEventListener('pointerdown', kick, { once: false });
  window.addEventListener('keydown', kick, { once: false });
  window.addEventListener('touchstart', kick, { once: false, passive: true });
}

  __x.audio = audio;
  __x.audioBoot = audioBoot;
};
__registry["js/core/input.js"] = function (__x, __req) {
// Entrada unificada: teclado, mando y controles táctiles.

const KEY_ALIASES = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'handbrake',
  KeyP: 'pit',
  KeyR: 'rescue',
  KeyC: 'camera',
  Escape: 'pause',
  Tab: 'pause',
  KeyE: 'drs',
  KeyH: 'help',
  Enter: 'confirm',
  KeyM: 'mute',
  Digit1: 'cam1',
  Digit2: 'cam2',
  Digit3: 'cam3',
  Digit4: 'sim1',
  Digit5: 'sim2',
  Digit6: 'sim3',
  KeyG: 'ghost',
  KeyX: 'ers',
};

class InputManager {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.touch = { steer: 0, throttle: 0, brake: 0, drs: false, pit: false, handbrake: false };
    this.gamepadIndex = null;
    this.hasGamepad = false;
    this.steerSmooth = 0;
    this.enabled = true;
    this.captureText = false;
    this._listeners = [];
    this._prevButtons = [];
    this._prevTriggers = [0, 0];
    this.lastDevice = 'keyboard';
  }

  attach(target = window) {
    const onKeyDown = (e) => {
      if (this.captureText) {
        if (e.code === 'Escape') this.pressed.add('pause');
        return;
      }
      const mapped = KEY_ALIASES[e.code] || (e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.toLowerCase());
      if (e.code === 'Tab' || (e.code === 'Space' && this.held.size === 0) || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(mapped)) this.pressed.add(mapped);
      this.held.add(mapped);
      this.lastDevice = 'keyboard';
    };
    const onKeyUp = (e) => {
      const mapped = KEY_ALIASES[e.code] || (e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.toLowerCase());
      this.held.delete(mapped);
      this.released.add(mapped);
    };
    const onBlur = () => {
      for (const k of this.held) this.released.add(k);
      this.held.clear();
    };
    target.addEventListener('keydown', onKeyDown, { passive: false });
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    this._listeners.push([target, 'keydown', onKeyDown], [target, 'keyup', onKeyUp], [target, 'blur', onBlur]);
    window.addEventListener('gamepadconnected', () => {
      this.hasGamepad = true;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.hasGamepad = !!navigator.getGamepads?.().find(Boolean);
    });
  }

  detach() {
    for (const [t, type, fn] of this._listeners) t.removeEventListener(type, fn);
    this._listeners = [];
  }

  setDrivingEnabled(on) {
    this.enabled = Boolean(on);
  }

  isDown(name) {
    return this.held.has(name);
  }

  consumePress(name) {
    if (this.pressed.has(name)) {
      this.pressed.delete(name);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  /* ───────────────Paleta de mando ─────────────── */
  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    const pad = pads && (pads[this.gamepadIndex] || Array.from(pads).find(Boolean));
    if (!pad || !pad.connected) return null;
    const ax = pad.axes[0] ?? 0;
    const rt = pad.buttons[7]?.value ?? 0;
    const lt = pad.buttons[6]?.value ?? 0;
    const buttons = pad.buttons.map((b) => (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5));
    if (ax !== 0 || rt > 0.02 || lt > 0.02 || buttons.some(Boolean)) this.lastDevice = 'gamepad';
    return { ax, rt, lt, buttons };
  }

  /** Estado de conducción normalizado. */
  driving(dt = 1 / 60) {
    const out = {
      steer: 0,
      throttle: 0,
      brake: 0,
      handbrake: false,
      drsPressed: false,
      pitPressed: false,
      rescue: false,
    };
    if (!this.enabled) return out;

    if (this.held.has('left')) out.steer -= 1;
    if (this.held.has('right')) out.steer += 1;
    if (this.held.has('up')) out.throttle = 1;
    if (this.held.has('down')) out.throttle = -1;
    if (this.held.has('handbrake')) out.handbrake = true;

    const pad = this.pollGamepad();
    if (pad) {
      const dead = 0.12;
      if (Math.abs(pad.ax) > dead) out.steer = pad.ax;
      out.throttle = Math.max(out.throttle, pad.rt);
      if (pad.lt > 0.02) out.brake = Math.max(out.brake, pad.lt);
      if (pad.buttons[0]) out.handbrake = true;
      const dpad = (i) => (pad.buttons[i] ? 1 : 0);
      out.steer = clampNum(out.steer - dpad(14) + dpad(15), -1, 1);
    }

    /* Frenar con el teclado es acelerar hacia atrás: se traduce a freno.
       Sin esto la tecla de freno no hacía nada y solo se frenaba con mando. */
    if (out.throttle < 0) {
      out.brake = Math.max(out.brake, -out.throttle);
      out.throttle = 0;
    }

    /* táctil */
    out.steer = clampNum(out.steer + this.touch.steer, -1, 1);
    out.throttle = clampNum(Math.max(out.throttle, this.touch.throttle), 0, 1);
    out.brake = clampNum(Math.max(out.brake, this.touch.brake), 0, 1);
    if (this.touch.handbrake) out.handbrake = true;

    /* disparadores de flanco */
    if (this.pressed.has('drs') || this.pressed.has('e') || this.touch.drs) out.drsPressed = true;
    if (this.pressed.has('pit') || this.pressed.has('p') || this.touch.pit) out.pitPressed = true;
    if (this.pressed.has('rescue') || this.pressed.has('r')) out.rescue = true;
    this.touch.drs = false;
    this.touch.pit = false;

    /* suavizado analógico de la dirección (evita vibración del teclado) */
    const target = out.steer;
    const rate = target === 0 ? 12 : 7.5;
    this.steerSmooth += (target - this.steerSmooth) * Math.min(1, rate * dt);
    if (Math.abs(target) < 0.02) this.steerSmooth *= 0.82;
    out.steer = clampNum(this.steerSmooth, -1, 1);
    return out;
  }

  /* ─────────────── Controles táctiles ─────────────── */
  bindTouch(root) {
    if (!root || root.dataset.touchBound === '1') return;
    root.dataset.touchBound = '1';
    const wheel = root.querySelector('[data-touch="steer"]');
    const thr = root.querySelector('[data-touch="throttle"]');
    const brk = root.querySelector('[data-touch="brake"]');

    if (wheel) {
      let active = false;
      const update = (clientX) => {
        const rect = wheel.getBoundingClientRect();
        const rel = (clientX - rect.left) / rect.width;
        this.touch.steer = clampNum(rel * 2 - 1, -1, 1) * 0.92;
        this.lastDevice = 'touch';
      };
      const onStart = (e) => {
        active = true;
        update(e.touches ? e.touches[0].clientX : e.clientX);
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!active) return;
        update(e.touches ? e.touches[0].clientX : e.clientX);
        e.preventDefault();
      };
      const onEnd = () => {
        active = false;
        this.touch.steer = 0;
      };
      wheel.addEventListener('pointerdown', onStart);
      wheel.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      wheel.addEventListener('pointercancel', onEnd);
    }

    const bindPedal = (node, key) => {
      if (!node) return;
      const on = (e) => {
        this.touch[key] = 1;
        node.classList.add('is-down');
        e.preventDefault();
      };
      const off = (e) => {
        this.touch[key] = 0;
        node.classList.remove('is-down');
        e.preventDefault();
      };
      node.addEventListener('pointerdown', on);
      node.addEventListener('pointerup', off);
      node.addEventListener('pointercancel', off);
      node.addEventListener('pointerleave', off);
    };
    bindPedal(thr, 'throttle');
    bindPedal(brk, 'brake');

    for (const node of root.querySelectorAll('[data-action-touch]')) {
      const act = node.dataset.actionTouch;
      node.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (act in this.touch) this.touch[act] = true;
        else this.pressed.add(act);
        node.classList.add('is-down');
      });
      const clear = () => node.classList.remove('is-down');
      node.addEventListener('pointerup', clear);
      node.addEventListener('pointercancel', clear);
    }
  }
}

function clampNum(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

const input = new InputManager();

  __x.input = input;
};
__registry["js/core/rng.js"] = function (__x, __req) {
// Generador pseudoaleatorio determinista (mulberry32) para carreras reproducibles.

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
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
    /**
     * Elección ponderada.
     *   rng.weighted(items, weightOf)
     *   rng.weighted({ items, weightOf })
     *   rng.weighted(items) con items.weight(item) ya asignado
     */
    weighted(pick, weightFn) {
      const items = Array.isArray(pick) ? pick : pick.items;
      const weightOf =
        weightFn || (Array.isArray(pick) ? pick.weight : pick.weightOf) || (() => 1);
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

function randomSeed() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

  __x.hashString = hashString;
  __x.makeRng = makeRng;
  __x.randomSeed = randomSeed;
};
__registry["js/core/storage.js"] = function (__x, __req) {
// Persistencia local: ajustes, partidas guardadas (autoguardado) e import/export.

const PREFIX = 'f1predestinato';
const KEYS = {
  settings: `${PREFIX}.settings`,
  slots: `${PREFIX}.slots`,
  slot: (i) => `${PREFIX}.slot.${i}`,
  last: `${PREFIX}.last`,
  seen: `${PREFIX}.seen`,
  tips: `${PREFIX}.tips`,
};

const SLOT_COUNT = 3;
const SAVE_VERSION = 2;

function safeLocal() {
  try {
    const k = '__f1p_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      isMemory: true,
    };
  }
}

const store = typeof window !== 'undefined' ? safeLocal() : null;
const memoryFallback = new Map();

function readRaw(key) {
  if (!store) return memoryFallback.get(key) ?? null;
  try {
    return store.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function writeRaw(key, value) {
  if (!store) {
    memoryFallback.set(key, value);
    return true;
  }
  try {
    store.setItem(key, value);
    return true;
  } catch {
    memoryFallback.set(key, value);
    return false;
  }
}

function readJson(key, fallback = null) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  return writeRaw(key, JSON.stringify(value));
}

function removeKey(key) {
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      /* ignora */
    }
  }
  memoryFallback.delete(key);
}

/* ───────────────────────── Ajustes ───────────────────────── */

const DEFAULT_SETTINGS = {
  sound: true,
  sfx: true,
  engineVolume: 0.75,
  musicVolume: 0.45,
  crowdVolume: 0.5,
  difficulty: 'pro' /* amateur | pro | legendary */,
  assists: true,
  steeringAssist: 0.55,
  tractionControl: true,
  abs: true,
  autoDrs: true,
  brakeAssist: true,
  stability: 0.6,
  units: 'metric' /* metric | imperial */,
  startTyre: 'medium' /* soft | medium | hard: compuesto elegido para la carrera */,
  hudScale: 1,
  simSpeed: 1,
  showMinimap: true,
  showTiming: true,
  reduceMotion: false,
};

function loadSettings() {
  const saved = readJson(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

function saveSettings(settings) {
  return writeJson(KEYS.settings, settings);
}

/* ─────────────────────── Partidas guardadas ─────────────────────── */

/** @returns {Array<{index:number,empty:boolean,meta:object|null}>} */
function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const data = readSlot(i);
    out.push({ index: i, empty: !data, meta: data ? data.meta || {} : null });
  }
  return out;
}

function readSlot(index) {
  const data = readJson(KEYS.slot(index), null);
  if (!data || data.version !== SAVE_VERSION || !data.state) return null;
  return data;
}

function writeSlot(index, state, meta) {
  const payload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta: meta || state.meta || {},
    state,
  };
  const ok = writeJson(KEYS.slot(index), payload);
  if (ok) {
    writeJson(KEYS.last, { index, savedAt: payload.savedAt });
    return true;
  }
  return false;
}

function deleteSlot(index) {
  removeKey(KEYS.slot(index));
  const last = readJson(KEYS.last, null);
  if (last && last.index === index) removeKey(KEYS.last);
  return true;
}

function lastSlotIndex() {
  const last = readJson(KEYS.last, null);
  if (!last) return null;
  return readSlot(last.index) ? last.index : null;
}

function hasAnySave() {
  return lastSlotIndex() !== null;
}

/* ─────────────────────── Importar / exportar ─────────────────────── */

function exportSlot(index) {
  const data = readSlot(index);
  if (!data) return null;
  return JSON.stringify(data, null, 2);
}

function importSlot(json, targetIndex = null) {
  let parsed;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state) {
    throw new Error('El archivo no es una partida de Predestinato.');
  }
  let index = targetIndex;
  if (index === null) {
    const free = listSlots().find((s) => s.empty);
    index = free ? free.index : 0;
  }
  writeJson(KEYS.slot(index), parsed);
  writeJson(KEYS.last, { index, savedAt: parsed.savedAt || new Date().toISOString() });
  return index;
}

function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

function pickTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    input.click();
  });
}

/* ─────────────────────── Marcadores de visto ─────────────────────── */

function seenFlag(key) {
  const bag = readJson(KEYS.seen, {});
  return Boolean(bag[key]);
}

function markSeen(key) {
  const bag = readJson(KEYS.seen, {});
  bag[key] = Date.now();
  writeJson(KEYS.seen, bag);
}

function storageInfo() {
  const inMemory = !store || store.isMemory === true;
  let bytes = 0;
  try {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const raw = readRaw(KEYS.slot(i));
      if (raw) bytes += raw.length;
    }
    const s = readRaw(KEYS.settings);
    if (s) bytes += s.length;
  } catch {
    /* ignora */
  }
  return { inMemory, bytes, kilobytes: Math.round(bytes / 102.4) / 10 };
}

  __x.KEYS = KEYS;
  __x.SLOT_COUNT = SLOT_COUNT;
  __x.SAVE_VERSION = SAVE_VERSION;
  __x.readJson = readJson;
  __x.writeJson = writeJson;
  __x.removeKey = removeKey;
  __x.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  __x.loadSettings = loadSettings;
  __x.saveSettings = saveSettings;
  __x.listSlots = listSlots;
  __x.readSlot = readSlot;
  __x.writeSlot = writeSlot;
  __x.deleteSlot = deleteSlot;
  __x.lastSlotIndex = lastSlotIndex;
  __x.hasAnySave = hasAnySave;
  __x.exportSlot = exportSlot;
  __x.importSlot = importSlot;
  __x.downloadText = downloadText;
  __x.pickTextFile = pickTextFile;
  __x.seenFlag = seenFlag;
  __x.markSeen = markSeen;
  __x.storageInfo = storageInfo;
};
__registry["js/core/util.js"] = function (__x, __req) {
// Utilidades matemáticas, de formato y de fecha.

const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const mix = lerp;
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
const mod = (a, n) => ((a % n) + n) % n;

/** Diferencia angular normalizada en (-PI, PI]. */
function angleDelta(a, b) {
  let d = mod(b - a + Math.PI, TAU) - Math.PI;
  if (d === -Math.PI) d = Math.PI;
  return d;
}

function wrapAngle(a) {
  return mod(a, TAU);
}

function moveTowards(current, target, maxDelta) {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + sign(d) * maxDelta;
}

function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmtInt(n) {
  return Math.round(n).toLocaleString('es-ES');
}

/** 83456 -> "1:23.456" */
function fmtLap(ms) {
  if (!isFinite(ms) || ms <= 0) return '--:--.---';
  const total = Math.floor(ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const t = total % 1000;
  return `${m}:${pad2(s)}.${String(t).padStart(3, '0')}`;
}

/** Sector / vuelta corta -> "23.456" */
function fmtShort(ms) {
  if (!isFinite(ms) || ms <= 0) return '--.---';
  return (ms / 1000).toFixed(3);
}

function fmtGap(ms) {
  if (!isFinite(ms) || ms === 0) return '—';
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    return `+${m}:${pad2(Math.floor((ms % 60000) / 1000))}`;
  }
  if (ms >= 1000) return `+${(ms / 1000).toFixed(3)}`;
  return `+${(ms / 1000).toFixed(3)}`;
}

function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function toIso(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDays(iso, days) {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

function dayName(iso) {
  return DIAS[parseDate(iso).getUTCDay()];
}

function fmtDate(iso, opts = {}) {
  const d = parseDate(iso);
  const mes = opts.short ? MESES_CORTO[d.getUTCMonth()] : MESES[d.getUTCMonth()];
  if (opts.compact) return `${d.getUTCDate()} ${mes}`;
  return `${d.getUTCDate()} de ${mes} de ${d.getUTCFullYear()}`;
}

function fmtDayDate(iso) {
  const d = parseDate(iso);
  return `${DIAS[d.getUTCDay()][0].toUpperCase() + DIAS[d.getUTCDay()].slice(1)} ${d.getUTCDate()} ${MESES_CORTO[d.getUTCMonth()]}`;
}

function weekday(iso) {
  return DIAS[parseDate(iso).getUTCDay()].slice(0, 3);
}

/** Intervalo tipo "6–8 MAR" a partir de dos fechas ISO. */
function fmtRange(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (da.getUTCMonth() === db.getUTCMonth()) {
    return `${da.getUTCDate()}–${db.getUTCDate()} ${MESES_CORTO[db.getUTCMonth()]}`;
  }
  return `${da.getUTCDate()} ${MESES_CORTO[da.getUTCMonth()]} – ${db.getUTCDate()} ${MESES_CORTO[db.getUTCMonth()]}`;
}

function ordinal(n) {
  const s = ['º', 'º', 'º', 'º', 'º', 'º', 'º', 'º', 'º', 'º'];
  return `${n}${s[Math.min(9, Math.max(0, n - 1))]}`;
}

function titleCase(str) {
  return String(str).replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Interpolación segura de plantillas: {{clave}} */
function tpl(str, data) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (m, k) => (data && k in data ? data[k] : m));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const c = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(lerp(A.r, B.r, t), lerp(A.g, B.g, t), lerp(A.b, B.b, t));
}

function shade(hex, amount) {
  return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount);
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function readableOn(hex) {
  return luminance(hex) > 0.58 ? '#0b0c10' : '#ffffff';
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Número de posiciones conuko formato ordinal corto: 1º, 2º… */
function pos(n) {
  return `${n}º`;
}

function sum(arr, pick = (v) => v) {
  return arr.reduce((a, v) => a + (pick(v) || 0), 0);
}

function last(arr) {
  return arr && arr.length ? arr[arr.length - 1] : undefined;
}

function byDesc(pick) {
  return (a, b) => pick(b) - pick(a);
}

function groupBy(arr, pick) {
  const out = new Map();
  for (const item of arr) {
    const k = pick(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

function deepClone(value) {
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
function gauss(rng) {
  return (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 0.8660254;
}

function pickWeighted(rng, items, weightOf) {
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

  __x.TAU = TAU;
  __x.clamp = clamp;
  __x.lerp = lerp;
  __x.invLerp = invLerp;
  __x.smoothstep = smoothstep;
  __x.mix = mix;
  __x.deg = deg;
  __x.rad = rad;
  __x.sign = sign;
  __x.mod = mod;
  __x.angleDelta = angleDelta;
  __x.wrapAngle = wrapAngle;
  __x.moveTowards = moveTowards;
  __x.approach = approach;
  __x.dist2 = dist2;
  __x.dist = dist;
  __x.pad2 = pad2;
  __x.fmtInt = fmtInt;
  __x.fmtLap = fmtLap;
  __x.fmtShort = fmtShort;
  __x.fmtGap = fmtGap;
  __x.fmtDuration = fmtDuration;
  __x.parseDate = parseDate;
  __x.toIso = toIso;
  __x.addDays = addDays;
  __x.dayName = dayName;
  __x.fmtDate = fmtDate;
  __x.fmtDayDate = fmtDayDate;
  __x.weekday = weekday;
  __x.fmtRange = fmtRange;
  __x.ordinal = ordinal;
  __x.titleCase = titleCase;
  __x.slugify = slugify;
  __x.escapeHtml = escapeHtml;
  __x.tpl = tpl;
  __x.hexToRgb = hexToRgb;
  __x.rgbToHex = rgbToHex;
  __x.mixHex = mixHex;
  __x.shade = shade;
  __x.luminance = luminance;
  __x.readableOn = readableOn;
  __x.withAlpha = withAlpha;
  __x.pos = pos;
  __x.sum = sum;
  __x.last = last;
  __x.byDesc = byDesc;
  __x.groupBy = groupBy;
  __x.deepClone = deepClone;
  __x.gauss = gauss;
  __x.pickWeighted = pickWeighted;
};
__registry["js/data/calendar.js"] = function (__x, __req) {
// Calendarios oficiales de la temporada 2026 de Fórmula 1 y de Fórmula 2.
// Fechas reales publicadas por la FIA: 23 Grandes Premios en F1 y 14 rondas en F2.
// Bahrain y Arabia Saudí se caen de la F1 de 2026 y ambos fichajes pasan a la F2.
// Fuente: calendarsporting de la FIA y formula1.com/en/racing/2026.

const { getCircuit } = __req("js/data/circuits.js");
const { addDays } = __req("js/core/util.js");

const SEASON = 2026;

const SERIES = {
  f1: { id: 'f1', name: 'Fórmula 1', short: 'F1', flag: '🏎️' },
  f2: { id: 'f2', name: 'Fórmula 2', short: 'F2', flag: '🏁' },
};

/** Tabla de puntos 2026 (idéntica a 2025): 25-18-15-12-10-8-6-4-2-1 + vuelta rápida. */
const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const FASTEST_LAP_POINT = 1;

/* ─────────────────── F1 2026: 23 Grandes Premios ─────────────────── */

const F1_BASE = [
  ['albert-park', 'Australian Grand Prix', '2026-03-06', false],
  ['shanghai', 'Chinese Grand Prix', '2026-03-13', true],
  ['suzuka', 'Japanese Grand Prix', '2026-03-27', false],
  ['miami', 'Miami Grand Prix', '2026-05-01', true],
  ['montreal', 'Canadian Grand Prix', '2026-05-22', true],
  ['monaco', 'Monaco Grand Prix', '2026-06-05', false],
  ['barcelona', 'Barcelona-Catalunya Grand Prix', '2026-06-12', false],
  ['spielberg', 'Austrian Grand Prix', '2026-06-26', false],
  ['silverstone', 'British Grand Prix', '2026-07-03', true],
  ['spa', 'Belgian Grand Prix', '2026-07-17', false],
  ['hungaroring', 'Hungarian Grand Prix', '2026-07-24', false],
  ['zandvoort', 'Dutch Grand Prix', '2026-08-21', true],
  ['monza', 'Italian Grand Prix', '2026-09-04', false],
  ['madring', 'Spanish Grand Prix', '2026-09-11', false],
  ['baku', 'Azerbaijan Grand Prix', '2026-09-24', false],
  ['sepang', 'Malaysian Grand Prix', '2026-10-02', false],
  ['marina-bay', 'Singapore Grand Prix', '2026-10-09', true],
  ['cota', 'United States Grand Prix', '2026-10-23', false],
  ['mexico', 'Mexico City Grand Prix', '2026-10-30', false],
  ['interlagos', 'São Paulo Grand Prix', '2026-11-06', false],
  ['las-vegas', 'Las Vegas Grand Prix', '2026-11-19', false],
  ['lusail', 'Qatar Grand Prix', '2026-11-27', false],
  ['yas-marina', 'Abu Dhabi Grand Prix', '2026-12-04', false],
];

/* ─────────────────── F2 2026: 14 rondas ─────────────────── */

const F2_BASE = [
  ['albert-park', 'Melbourne', '2026-03-06'],
  ['miami', 'Miami', '2026-05-01'],
  ['montreal', 'Montréal', '2026-05-22'],
  ['monaco', 'Monte-Carlo', '2026-06-04'],
  ['barcelona', 'Barcelona', '2026-06-12'],
  ['spielberg', 'Spielberg', '2026-06-26'],
  ['silverstone', 'Silverstone', '2026-07-03'],
  ['spa', 'Spa-Francorchamps', '2026-07-17'],
  ['hungaroring', 'Budapest', '2026-07-24'],
  ['monza', 'Monza', '2026-09-04'],
  ['madring', 'Madrid', '2026-09-11'],
  ['baku', 'Baku', '2026-09-24'],
  ['lusail', 'Lusail', '2026-11-27'],
  ['yas-marina', 'Yas Marina', '2026-12-04'],
];

/* ─────────────────── Estructura de fin de semana ─────────────────── */

/**
 * F1 sin sprint:  Jue FP1 · Vie FP2 · Sáb FP3 + Q1/Q2/Q3 · Dom Carrera
 * F1 con sprint:   Jue FP1 · Vie FP2 + Shootout · Sáb Sprint + Q1/Q2/Q3 · Dom Carrera
 * F2:              Jue FP1 · Vie FP2 · Sáb Q1/Q2 · Dom Sprint + Carrera
 */
const SESSION_TYPES = {
  fp: { kind: 'fp', required: false, segments: 0 },
  sprint: { kind: 'sprint', required: true, segments: 0 },
  sprintQuali: { kind: 'sprintQuali', required: true, segments: 2 },
  quali: { kind: 'quali', required: true, segments: 3 },
  feature: { kind: 'feature', required: true, segments: 0 },
};

function session(id, name, day, date, minutes, type) {
  const meta = SESSION_TYPES[type];
  return {
    id,
    name,
    short: name.replace('Libres', 'FP'),
    day,
    date,
    minutes,
    type: meta.kind,
    required: meta.required,
    segments: meta.segments,
    played: false,
    result: null,
  };
}

function buildWeekend(series, circuitId, gpName, sunday, sprint) {
  const thu = addDays(sunday, -3);
  const fri = addDays(sunday, -2);
  const sat = addDays(sunday, -1);
  const circuit = getCircuit(circuitId);
  const sessions = [];

  if (series === 'f2') {
    sessions.push(session('fp1', 'Libres 1', 'thu', thu, 45, 'fp'));
    sessions.push(session('fp2', 'Libres 2', 'fri', fri, 45, 'fp'));
    sessions.push(session('quali', 'Clasificación', 'sat', sat, 25, 'quali'));
    sessions.push(session('sprint', 'Carrera Sprint', 'sun', sunday, 45, 'sprint'));
    sessions.push(session('feature', 'Carrera Principal', 'sun', sunday, 70, 'feature'));
  } else if (sprint) {
    sessions.push(session('fp1', 'Libres 1', 'thu', thu, 60, 'fp'));
    sessions.push(session('fp2', 'Libres 2', 'fri', fri, 45, 'fp'));
    sessions.push(session('sprintQuali', 'Shootout', 'fri', fri, 15, 'sprintQuali'));
    sessions.push(session('sprint', 'Carrera Sprint', 'sat', sat, 25, 'sprint'));
    sessions.push(session('quali', 'Clasificación', 'sat', sat, 25, 'quali'));
    sessions.push(session('race', 'Gran Premio', 'sun', sunday, 120, 'feature'));
  } else {
    sessions.push(session('fp1', 'Libres 1', 'thu', thu, 60, 'fp'));
    sessions.push(session('fp2', 'Libres 2', 'fri', fri, 60, 'fp'));
    sessions.push(session('fp3', 'Libres 3', 'sat', sat, 30, 'fp'));
    sessions.push(session('quali', 'Clasificación', 'sat', sat, 25, 'quali'));
    sessions.push(session('race', 'Gran Premio', 'sun', sunday, 120, 'feature'));
  }

  return {
    circuitId,
    circuit,
    gp: gpName,
    sprint,
    days: { thu, fri, sat, sun: sunday },
    sessions,
  };
}

function buildRounds(series, base) {
  return base.map((row, i) => {
    const [circuitId, gp, sunday, sprint] = row;
    return {
      series,
      round: i + 1,
      circuitId,
      circuit: getCircuit(circuitId),
      country: getCircuit(circuitId).country,
      flag: getCircuit(circuitId).flag,
      gp: gp,
      sprint: Boolean(sprint),
      ...buildWeekend(series, circuitId, gp, sunday, Boolean(sprint)),
    };
  });
}

const F1_ROUNDS = buildRounds('f1', F1_BASE);
const F2_ROUNDS = buildRounds('f2', F2_BASE);

/** Fechas de los tests de pretemporada de 2026. */
const TESTING = {
  f1: [
    { name: 'Tests 1', circuitId: 'sakhir', from: '2026-02-11', to: '2026-02-13' },
    { name: 'Tests 2', circuitId: 'sakhir', from: '2026-02-18', to: '2026-02-20' },
  ],
  f2: [{ name: 'Tests de F2', circuitId: 'barcelona', from: '2026-02-17', to: '2026-02-19' }],
};

/* ─────────────────── Consultas ─────────────────── */

const BY_SERIES = { f1: F1_ROUNDS, f2: F2_ROUNDS };

function roundsFor(series) {
  return BY_SERIES[series] || F1_ROUNDS;
}

function roundCount(series) {
  return roundsFor(series).length;
}

function getRound(series, roundNumber) {
  return roundsFor(series)[Math.max(0, Math.min(roundsFor(series).length - 1, roundNumber - 1))];
}

function findRoundByCircuit(series, circuitId) {
  return roundsFor(series).find((r) => r.circuitId === circuitId) || null;
}

/** Sesión obligatoria o opcional más próxima que el jugador aún no ha corrido. */
function nextPendingSession(round) {
  return round.sessions.find((s) => !s.played && s.required) || null;
}

function firstOptionalSession(round) {
  return round.sessions.find((s) => !s.played && !s.required) || null;
}

function roundRaceSession(round) {
  return round.sessions.find((s) => s.type === 'feature') || null;
}

function roundIsComplete(round) {
  return round.sessions.filter((s) => s.required).every((s) => s.played);
}

/** Etiqueta corta de fin de semana: "6–8 MAR". */
function weekendLabel(round) {
  const { fri, sun } = round.days;
  const month = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][
    new Date(`${sun}T00:00:00Z`).getUTCMonth()
  ];
  return `${fri.slice(8, 10)}–${sun.slice(8, 10)} ${month}`;
}

/** Etiqueta del tipo de carrera que se corre: "Gran Premio", "Carrera Principal"... */
function mainSessionName(round) {
  return round.series === 'f2' ? 'Carrera Principal' : 'Gran Premio';
}

  __x.SEASON = SEASON;
  __x.SERIES = SERIES;
  __x.POINTS_TABLE = POINTS_TABLE;
  __x.FASTEST_LAP_POINT = FASTEST_LAP_POINT;
  __x.F1_ROUNDS = F1_ROUNDS;
  __x.F2_ROUNDS = F2_ROUNDS;
  __x.TESTING = TESTING;
  __x.roundsFor = roundsFor;
  __x.roundCount = roundCount;
  __x.getRound = getRound;
  __x.findRoundByCircuit = findRoundByCircuit;
  __x.nextPendingSession = nextPendingSession;
  __x.firstOptionalSession = firstOptionalSession;
  __x.roundRaceSession = roundRaceSession;
  __x.roundIsComplete = roundIsComplete;
  __x.weekendLabel = weekendLabel;
  __x.mainSessionName = mainSessionName;
};
__registry["js/data/circuits.js"] = function (__x, __req) {
// Los 23 circuitos del calendario 2026 de Fórmula 1, más Sakhir, que hosts los
// tests de pretemporada. Trazados estilizados: rectas y curvas medidas en metros.
// Todas las carreras son de 20 vueltas sobre asfalto en seco.

const CIRCUITS = [
  {
    id: 'sakhir',
    name: 'Bahrain International Circuit',
    gp: null,
    city: 'Sakhir',
    country: 'BHR',
    flag: '🇧🇭',
    length: 5.412,
    laps: 20,
    record: '1:30.499',
    weather: 'dry',
    night: false,
    width: 19,
    corners: ['T1', 'T2-3', 'T4', 'T5-6-7', 'T8', 'T9-10', 'T11', 'T13', 'T15'],
    seg: [
      ['s', 480], ['c', 95, 62], ['c', 130, -38], ['c', 190, 30], ['c', 120, -44],
      ['c', 90, 40], ['c', 110, -34], ['s', 520], ['c', 85, 56], ['c', 60, 84],
      ['c', 150, -26], ['c', 70, 48], ['c', 200, 22], ['c', 100, -40], ['s', 320],
    ],
  },
  {
    id: 'albert-park',
    name: 'Albert Park',
    gp: 'Gran Premio de Australia',
    city: 'Melbourne',
    country: 'AUS',
    flag: '🇦🇺',
    length: 5.278,
    laps: 20,
    record: '1:15.481',
    weather: 'dry',
    width: 19,
    corners: ['T1 Graham Richardson', 'T2-3', 'T4-5', 'T6-7', 'T8-9', 'T10-11', 'T12', 'T13-14'],
    seg: [
      ['s', 460], ['c', 95, 96], ['c', 150, -34], ['c', 110, 66], ['s', 270],
      ['c', 70, 52], ['c', 70, -52], ['e', 320, 48, 4], ['c', 100, 62], ['c', 120, -36],
      ['c', 75, 66], ['c', 75, -66], ['c', 95, 62], ['s', 220],
    ],
  },
  {
    id: 'shanghai',
    name: 'Shanghai International Circuit',
    gp: 'Gran Premio de China',
    city: 'Shanghai',
    country: 'CHN',
    flag: '🇨🇳',
    length: 5.451,
    laps: 20,
    record: '1:33.660',
    weather: 'dry',
    width: 19,
    corners: ['T1-2-3', 'T4-5-6 Carousel', 'T7', 'T9-10', 'T11-12-13', 'T14'],
    seg: [
      ['s', 880], ['c', 130, 46], ['c', 130, -46], ['c', 220, 40], ['c', 320, -26],
      ['c', 150, 44], ['s', 360], ['c', 95, 62], ['c', 160, -34], ['c', 130, 40],
      ['c', 100, -64], ['c', 60, 86], ['c', 45, 92], ['s', 620],
    ],
  },
  {
    id: 'suzuka',
    name: 'Suzuka International Racing Course',
    gp: 'Gran Premio de Japón',
    city: 'Suzuka',
    country: 'JPN',
    flag: '🇯🇵',
    length: 5.807,
    laps: 20,
    record: '1:30.781',
    weather: 'dry',
    width: 19,
    corners: ['T1', 'Degner 1-2', 'S Curves', 'Hairpin', 'Spoon', '130R', 'Casio Triangle'],
    seg: [
      ['s', 330], ['c', 210, 30], ['e', 420, 46, 4], ['c', 160, -26], ['c', 130, 52],
      ['c', 95, -58], ['c', 130, 34], ['c', 85, 66], ['c', 60, 88], ['s', 430],
      ['c', 95, 44], ['c', 210, -26], ['c', 320, -34], ['s', 420], ['c', 150, 44], ['c', 110, -30],
    ],
  },
  {
    id: 'miami',
    name: 'Miami International Autodrome',
    gp: 'Gran Premio de Miami',
    city: 'Miami',
    country: 'USA',
    flag: '🇺🇸',
    length: 5.412,
    laps: 20,
    record: '1:27.241',
    weather: 'dry',
    night: false,
    width: 19,
    corners: ['T1', 'T2-3', 'T4-5-6', 'T7', 'T8-9', 'T11-12', 'T14-15', 'T16', 'T17'],
    seg: [
      ['s', 520], ['c', 80, 66], ['c', 140, -34], ['c', 210, -28], ['c', 110, 46],
      ['c', 90, -54], ['c', 160, 34], ['c', 260, -24], ['s', 330], ['c', 38, 82],
      ['c', 120, -40], ['c', 140, 32], ['c', 100, -48], ['c', 210, -22], ['s', 380],
      ['c', 75, 58], ['c', 70, -58], ['c', 110, 42], ['s', 300],
    ],
  },
  {
    id: 'montreal',
    name: 'Circuit Gilles Villeneuve',
    gp: 'Gran Premio de Canadá',
    city: 'Montréal',
    country: 'CAN',
    flag: '🇨🇦',
    length: 4.361,
    laps: 20,
    record: '1:12.000',
    weather: 'dry',
    width: 20,
    corners: ['T1-2 Hairpin', 'T3-4 Esses', 'T5-6-7', 'T8-9', 'T10-11', 'T12', 'T13-14-15 Wall of Champions'],
    seg: [
      ['s', 430], ['c', 48, 90], ['c', 48, 84], ['s', 240], ['c', 65, 62], ['c', 65, -62],
      ['c', 75, 58], ['c', 75, -58], ['c', 95, 50], ['c', 70, -62], ['c', 90, 54],
      ['s', 190], ['c', 110, -32], ['c', 130, 38], ['c', 60, 74], ['c', 70, 82], ['c', 60, 80],
      ['s', 600],
    ],
  },
  {
    id: 'monaco',
    name: 'Circuit de Monaco',
    gp: 'Gran Premio de Mónaco',
    city: 'Mónaco',
    country: 'MON',
    flag: '🇲🇨',
    length: 3.337,
    laps: 20,
    record: '1:12.271',
    weather: 'dry',
    width: 18,
    corners: ['Ste Fairmont', 'Hairpin Grand Hotel', 'Mirabeau', 'Tunnel', 'Nouvelle Chicane', 'Tabac', 'Swimming Pool', 'Rascasse', 'Anthony Noghes'],
    seg: [
      ['s', 210], ['c', 45, 120], ['c', 40, 130], ['s', 120], ['c', 35, 96], ['c', 35, -70],
      ['c', 32, 74], ['c', 34, -72], ['c', 36, 70], ['c', 38, -66], ['c', 40, 64], ['c', 42, -62],
      ['s', 200], ['c', 34, 78], ['c', 30, 84], ['c', 28, -80], ['c', 30, 76], ['c', 26, 88],
      ['c', 40, 70], ['s', 190],
    ],
  },
  {
    id: 'barcelona',
    name: 'Circuit de Barcelona-Catalunya',
    gp: 'Gran Premio de España',
    city: 'Barcelona',
    country: 'ESP',
    flag: '🇪🇸',
    length: 4.657,
    laps: 20,
    record: '1:11.262',
    weather: 'dry',
    width: 19,
    corners: ['T1', 'T2', 'T3', 'T4', 'T5', 'T7-8', 'T9-10', 'T12', 'T13-14-15'],
    seg: [
      ['s', 480], ['c', 260, 20], ['c', 95, 72], ['c', 300, -26], ['c', 85, 64],
      ['c', 210, 30], ['c', 75, 58], ['c', 160, -26], ['c', 105, 48], ['c', 70, -54],
      ['c', 125, 42], ['c', 85, -48], ['s', 420],
    ],
  },
  {
    id: 'spielberg',
    name: 'Red Bull Ring',
    gp: 'Gran Premio de Austria',
    city: 'Spielberg',
    country: 'AUT',
    flag: '🇦🇹',
    length: 4.318,
    laps: 20,
    record: '1:05.772',
    weather: 'dry',
    width: 19,
    corners: ['T1', 'T2-3', 'T4', 'T6-7', 'T8-9-10', 'T11'],
    seg: [
      ['s', 300], ['c', 250, 16], ['c', 65, 72], ['s', 300], ['c', 320, -20], ['c', 75, 64],
      ['s', 240], ['c', 110, -48], ['c', 90, 54], ['c', 70, -56], ['s', 520],
    ],
  },
  {
    id: 'silverstone',
    name: 'Silverstone Circuit',
    gp: 'Gran Premio de Gran Bretaña',
    city: 'Silverstone',
    country: 'GBR',
    flag: '🇬🇧',
    length: 5.891,
    laps: 20,
    record: '1:25.819',
    weather: 'dry',
    width: 20,
    corners: ['Abbey', 'Farm', 'Village', 'The Loop', 'Aintree', 'Wellington Straight', 'Brooklands', 'Luffield', 'Copse', 'Hangar Straight', 'Stowe', 'Vale', 'Club'],
    seg: [
      ['s', 470], ['c', 210, 26], ['c', 250, -20], ['c', 65, 64], ['c', 160, 30], ['c', 110, -42],
      ['c', 95, 48], ['c', 75, -58], ['c', 200, -26], ['c', 85, 50], ['e', 340, 42, 3],
      ['c', 60, 60], ['c', 110, -34], ['c', 75, 48], ['c', 55, -58], ['s', 520],
      ['c', 85, 40], ['c', 60, -48], ['c', 55, 54], ['s', 240],
    ],
  },
  {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    gp: 'Gran Premio de Bélgica',
    city: 'Spa',
    country: 'BEL',
    flag: '🇧🇪',
    length: 7.004,
    laps: 20,
    record: '1:53.117',
    weather: 'dry',
    width: 19,
    corners: ['La Source', 'Eau Rouge', 'Raidillon', 'Kemmel', 'Les Combes', 'Malmedy', 'Rivage', 'Pif-Paf', 'Bus Stop'],
    seg: [
      ['s', 480], ['c', 55, 60], ['c', 90, -55], ['s', 180], ['c', 42, 74], ['c', 48, -70],
      ['s', 430], ['c', 520, 16], ['c', 160, -40], ['c', 140, 46], ['c', 125, -50], ['c', 115, 52],
      ['s', 190], ['c', 260, -20], ['c', 85, 48], ['c', 95, -42], ['s', 700],
    ],
  },
  {
    id: 'hungaroring',
    name: 'Hungaroring',
    gp: 'Gran Premio de Hungría',
    city: 'Budapest',
    country: 'HUN',
    flag: '🇭🇺',
    length: 4.381,
    laps: 20,
    record: '1:16.627',
    weather: 'dry',
    width: 19,
    corners: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12-13', 'T14'],
    seg: [
      ['s', 400], ['c', 260, 16], ['c', 58, 68], ['c', 105, -46], ['c', 95, 52], ['c', 85, -56],
      ['c', 78, 58], ['c', 105, -42], ['c', 65, 54], ['c', 85, -48], ['c', 95, 38], ['c', 70, 48],
      ['c', 60, -44], ['s', 340],
    ],
  },
  {
    id: 'zandvoort',
    name: 'Circuit Zandvoort',
    gp: 'Gran Premio de los Países Bajos',
    city: 'Zandvoort',
    country: 'NED',
    flag: '🇳🇱',
    length: 4.259,
    laps: 20,
    record: '1:09.673',
    weather: 'dry',
    width: 19,
    corners: ['T1', 'Tarzan', 'Gerlach', 'Hugenholtz', 'Kink', 'Scheivlak', 'Arie Luyendyk'],
    seg: [
      ['s', 400], ['c', 260, 18], ['c', 52, 72], ['c', 105, -46], ['c', 85, 54], ['c', 95, -52],
      ['c', 65, 48], ['c', 85, -42], ['c', 65, 50], ['c', 48, 58], ['s', 400],
    ],
  },
  {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    gp: 'Gran Premio de Italia',
    city: 'Monza',
    country: 'ITA',
    flag: '🇮🇹',
    length: 5.793,
    laps: 20,
    record: '1:19.357',
    weather: 'dry',
    width: 19,
    corners: ['T1-2 Rettifilo', 'T3-4', 'Curva Grande', 'Variante della Roggia', 'Lesmo 1', 'Lesmo 2', 'Ascari 1-2-3', 'Parabolica'],
    seg: [
      ['s', 880], ['c', 95, 52], ['c', 95, -52], ['c', 210, -16], ['c', 48, 88], ['s', 480],
      ['c', 40, 62], ['c', 32, 78], ['c', 34, 70], ['s', 340], ['c', 48, 72], ['c', 48, -72],
      ['s', 200], ['c', 65, 52], ['s', 420],
    ],
  },
  {
    id: 'madring',
    name: 'Circuito de Madrid (Madring)',
    gp: 'Gran Premio de España',
    city: 'Madrid',
    country: 'ESP',
    flag: '🇪🇸',
    length: 5.1,
    laps: 20,
    record: '1:19.900',
    weather: 'dry',
    width: 20,
    corners: ['T1', 'T2-3', 'T4', 'T5-6', 'T7', 'T8-9', 'T10', 'T11-12', 'T13'],
    seg: [
      ['s', 700], ['c', 350, 20], ['c', 210, -26], ['c', 130, 48], ['s', 380], ['c', 260, -20],
      ['c', 85, 64], ['s', 280], ['c', 155, -36], ['c', 105, 52], ['s', 330], ['c', 95, 58],
      ['c', 75, -48], ['s', 480],
    ],
  },
  {
    id: 'baku',
    name: 'Baku City Circuit',
    gp: 'Gran Premio de Azerbaiyán',
    city: 'Bakú',
    country: 'AZE',
    flag: '🇦🇿',
    length: 6.003,
    laps: 20,
    record: '1:41.365',
    weather: 'dry',
    width: 18,
    corners: ['T1', 'T2-3', 'T4', 'T5', 'T6-7', 'T8', 'T9', 'T10-12', 'T13-16 Castle', 'T17-20', 'T21-23'],
    seg: [
      ['s', 1100], ['c', 210, 16], ['c', 62, 68], ['c', 105, -32], ['c', 42, 60], ['c', 95, -26],
      ['c', 30, 50], ['c', 28, -46], ['c', 30, 40], ['c', 26, -34], ['c', 28, 30], ['c', 125, -22],
      ['c', 42, 58], ['c', 65, -50], ['c', 55, 46], ['s', 330], ['c', 30, 32], ['c', 26, -28],
      ['c', 24, 24], ['c', 22, -22], ['c', 105, 20], ['s', 430],
    ],
  },
  {
    id: 'sepang',
    name: 'Sepang International Circuit',
    gp: 'Gran Premio de Malasia',
    city: 'Sepang',
    country: 'MAS',
    flag: '🇲🇾',
    length: 5.543,
    laps: 20,
    record: '1:34.671',
    weather: 'dry',
    width: 19,
    corners: ['T1-2', 'T3-4', 'T5-6', 'T7-8', 'T9-10', 'T11-12', 'T13-14', 'T15-16'],
    seg: [
      ['s', 580], ['c', 50, 88], ['c', 50, 86], ['s', 660], ['c', 110, 46], ['c', 95, -50],
      ['c', 85, 56], ['c', 75, -52], ['c', 65, 46], ['c', 58, -44], ['c', 130, 30], ['c', 85, -52],
      ['c', 48, 42], ['s', 500],
    ],
  },
  {
    id: 'marina-bay',
    name: 'Marina Bay Street Circuit',
    gp: 'Gran Premio de Singapur',
    city: 'Singapur',
    country: 'SIN',
    flag: '🇸🇬',
    length: 4.94,
    laps: 20,
    record: '1:29.525',
    weather: 'dry',
    night: true,
    width: 18,
    corners: ['T1-2', 'T3-4', 'T5', 'T7-8', 'T9-10', 'T11-12', 'T13', 'T14', 'T16', 'T17-18', 'T19-20'],
    seg: [
      ['s', 430], ['c', 200, 16], ['c', 60, 62], ['c', 95, -46], ['c', 55, 52], ['c', 85, 36],
      ['c', 48, -46], ['c', 72, 30], ['c', 42, -34], ['c', 62, 26], ['c', 50, -30], ['c', 45, 28],
      ['c', 40, -24], ['c', 36, 24], ['c', 32, -20], ['c', 65, 16], ['s', 240], ['c', 40, 34],
      ['c', 35, -30], ['c', 30, 26], ['c', 26, -24], ['c', 200, 20], ['s', 300],
    ],
  },
  {
    id: 'cota',
    name: 'Circuit of the Americas',
    gp: 'Gran Premio de Estados Unidos',
    city: 'Austin',
    country: 'USA',
    flag: '🇺🇸',
    length: 5.513,
    laps: 20,
    record: '1:32.330',
    weather: 'dry',
    width: 20,
    corners: ['T1', 'T2-3', 'T4-5', 'T6-7', 'T8', 'T9-10-11', 'T12', 'T15-16', 'T17-18', 'T19-20'],
    seg: [
      ['s', 540], ['c', 95, 62], ['s', 280], ['c', 210, -26], ['c', 105, 42], ['c', 95, -46],
      ['c', 85, 42], ['c', 310, -20], ['c', 105, 46], ['c', 62, -52], ['c', 58, 46], ['s', 380],
      ['c', 72, -36], ['c', 105, 30], ['c', 50, -30], ['s', 500],
    ],
  },
  {
    id: 'mexico',
    name: 'Autódromo Hermanos Rodríguez',
    gp: 'Gran Premio de México',
    city: 'Ciudad de México',
    country: 'MEX',
    flag: '🇲🇽',
    length: 4.304,
    laps: 20,
    record: '1:15.946',
    weather: 'dry',
    width: 19,
    corners: ['T1', 'T2-3', 'T4', 'T5-6-7', 'T8-9', 'T10-11', 'Peraltada', 'T17', 'T18'],
    seg: [
      ['s', 800], ['c', 65, 72], ['c', 135, -36], ['c', 260, 20], ['c', 95, -42], ['c', 105, 46],
      ['c', 85, -50], ['c', 72, 42], ['c', 62, -46], ['s', 330], ['c', 260, -20], ['c', 80, 40],
      ['s', 380],
    ],
  },
  {
    id: 'interlagos',
    name: 'Autódromo José Carlos Pace',
    gp: 'Gran Premio de Brasil',
    city: 'São Paulo',
    country: 'BRA',
    flag: '🇧🇷',
    length: 4.309,
    laps: 20,
    record: '1:08.503',
    weather: 'dry',
    width: 19,
    corners: ['T1-2', 'T3-4', 'T5', 'T6-7', 'Senna S', 'T8', 'T9-10', 'T11-12', 'Laranja', 'T13-14', 'T15 Ferradura'],
    seg: [
      ['s', 480], ['c', 200, 24], ['c', 95, -40], ['c', 75, 48], ['c', 65, -50], ['c', 85, 40],
      ['e', 300, 40, 3], ['c', 105, -34], ['c', 75, 46], ['c', 62, -44], ['s', 420], ['c', 210, 20],
      ['c', 85, -40], ['c', 72, 34], ['s', 330], ['c', 160, -24],
    ],
  },
  {
    id: 'las-vegas',
    name: 'Las Vegas Strip Circuit',
    gp: 'Gran Premio de Las Vegas',
    city: 'Las Vegas',
    country: 'USA',
    flag: '🇺🇸',
    length: 6.201,
    laps: 20,
    record: '1:32.312',
    weather: 'dry',
    night: true,
    width: 19,
    corners: ['T1-2', 'T3-4', 'T5', 'T6-7', 'T8-9', 'T10-11', 'T12', 'T14-15', 'T16-17'],
    seg: [
      ['s', 1150], ['c', 210, 16], ['c', 95, -30], ['c', 75, 40], ['c', 105, -20], ['c', 250, 14],
      ['s', 380], ['c', 85, -34],       ['c', 62, 30], ['c', 72, -24], ['c', 62, 24], ['c', 82, -20], ['c', 30, 40],
      ['s', 880], ['c', 105, 24], ['c', 70, -28], ['c', 60, 24], ['s', 300],
    ],
  },
  {
    id: 'lusail',
    name: 'Lusail International Circuit',
    gp: 'Gran Premio de Catar',
    city: 'Lusail',
    country: 'QAT',
    flag: '🇶🇦',
    length: 5.419,
    laps: 20,
    record: '1:20.827',
    weather: 'dry',
    night: true,
    width: 20,
    corners: ['T1', 'T2-3', 'T4-5-6-7', 'T8-9', 'T10-11', 'T12-13', 'T14-16', 'T17-19'],
    seg: [
      ['s', 980], ['c', 260, 20], ['c', 105, -46], ['c', 95, 50], ['c', 85, -40], ['c', 70, 34],
      ['c', 300, -16], ['c', 95, 42], ['c', 105, -50], ['c', 115, 50], ['c', 135, -20], ['s', 300],
    ],
  },
  {
    id: 'yas-marina',
    name: 'Yas Marina Circuit',
    gp: 'Gran Premio de Abu Dhabi',
    city: 'Abu Dhabi',
    country: 'UAE',
    flag: '🇦🇪',
    length: 5.281,
    laps: 20,
    record: '1:22.824',
    weather: 'dry',
    night: true,
    width: 20,
    corners: ['T1', 'T2-3', 'T4-5', 'T6-7', 'T8', 'T9', 'T10-11', 'T12-13', 'T14-15', 'T16'],
    seg: [
      ['s', 1080], ['c', 155, 20], ['c', 85, -40], ['c', 105, 30], ['c', 70, -35], ['c', 62, 40],
      ['c', 95, -25], ['c', 150, 20], ['c', 85, -30], ['s', 400],
    ],
  },
];

const BY_ID = new Map(CIRCUITS.map((c) => [c.id, c]));

function getCircuit(id) {
  return BY_ID.get(id) || null;
}

function circuitCount() {
  return CIRCUITS.length;
}

  __x.CIRCUITS = CIRCUITS;
  __x.getCircuit = getCircuit;
  __x.circuitCount = circuitCount;
};
__registry["js/data/countries.js"] = function (__x, __req) {
// Países selectable al crear el piloto, con bandera y gentilicio en español.

const COUNTRIES = [
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', demonym: 'Argentino' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', demonym: 'Australiano' },
  { code: 'AUT', name: 'Austria', flag: '🇦🇹', demonym: 'Austríaco' },
  { code: 'BEL', name: 'Bélgica', flag: '🇧🇪', demonym: 'Belga' },
  { code: 'BOL', name: 'Bolivia', flag: '🇧🇴', demonym: 'Boliviano' },
  { code: 'BRA', name: 'Brasil', flag: '🇧🇷', demonym: 'Brasileño' },
  { code: 'BUL', name: 'Bulgaria', flag: '🇧🇬', demonym: 'Búlgaro' },
  { code: 'CAN', name: 'Canadá', flag: '🇨🇦', demonym: 'Canadiense' },
  { code: 'CHL', name: 'Chile', flag: '🇨🇱', demonym: 'Chileno' },
  { code: 'CHN', name: 'China', flag: '🇨🇳', demonym: 'Chino' },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', demonym: 'Colombiano' },
  { code: 'CRI', name: 'Costa Rica', flag: '🇨🇷', demonym: 'Costarricense' },
  { code: 'CUB', name: 'Cuba', flag: '🇨🇺', demonym: 'Cubano' },
  { code: 'DEN', name: 'Dinamarca', flag: '🇩🇰', demonym: 'Danés' },
  { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', demonym: 'Ecuatoriano' },
  { code: 'ESP', name: 'España', flag: '🇪🇸', demonym: 'Español' },
  { code: 'USA', name: 'Estados Unidos', flag: '🇺🇸', demonym: 'Estadounidense' },
  { code: 'FIN', name: 'Finlandia', flag: '🇫🇮', demonym: 'Finés' },
  { code: 'FRA', name: 'Francia', flag: '🇫🇷', demonym: 'Francés' },
  { code: 'GER', name: 'Alemania', flag: '🇩🇪', demonym: 'Alemán' },
  { code: 'GHA', name: 'Ghana', flag: '🇬🇭', demonym: 'Ghanés' },
  { code: 'GRE', name: 'Grecia', flag: '🇬🇷', demonym: 'Griego' },
  { code: 'HUN', name: 'Hungría', flag: '🇭🇺', demonym: 'Húngaro' },
  { code: 'IND', name: 'India', flag: '🇮🇳', demonym: 'Indio' },
  { code: 'IDN', name: 'Indonesia', flag: '🇮🇩', demonym: 'Indonesio' },
  { code: 'IRL', name: 'Irlanda', flag: '🇮🇪', demonym: 'Irlandés' },
  { code: 'ISL', name: 'Islandia', flag: '🇮🇸', demonym: 'Islandés' },
  { code: 'ISR', name: 'Israel', flag: '🇮🇱', demonym: 'Israelí' },
  { code: 'ITA', name: 'Italia', flag: '🇮🇹', demonym: 'Italiano' },
  { code: 'JPN', name: 'Japón', flag: '🇯🇵', demonym: 'Japonés' },
  { code: 'KAZ', name: 'Kazajistán', flag: '🇰🇿', demonym: 'Kazajo' },
  { code: 'KOR', name: 'Corea del Sur', flag: '🇰🇷', demonym: 'Coreano' },
  { code: 'LAT', name: 'Letonia', flag: '🇱🇻', demonym: 'Letón' },
  { code: 'LUX', name: 'Luxemburgo', flag: '🇱🇺', demonym: 'Luxemburgués' },
  { code: 'LIT', name: 'Lituania', flag: '🇱🇹', demonym: 'Lituano' },
  { code: 'MAL', name: 'Malasia', flag: '🇲🇾', demonym: 'Malayo' },
  { code: 'MAR', name: 'Marruecos', flag: '🇲🇦', demonym: 'Marroquí' },
  { code: 'MEX', name: 'México', flag: '🇲🇽', demonym: 'Mexicano' },
  { code: 'MON', name: 'Mónaco', flag: '🇲🇨', demonym: 'Monegasco' },
  { code: 'NED', name: 'Países Bajos', flag: '🇳🇱', demonym: 'Neerlandés' },
  { code: 'NZL', name: 'Nueva Zelanda', flag: '🇳🇿', demonym: 'Neozelandés' },
  { code: 'NOR', name: 'Noruega', flag: '🇳🇴', demonym: 'Noruego' },
  { code: 'PAR', name: 'Paraguay', flag: '🇵🇾', demonym: 'Paraguayo' },
  { code: 'PER', name: 'Perú', flag: '🇵🇪', demonym: 'Peruano' },
  { code: 'POL', name: 'Polonia', flag: '🇵🇱', demonym: 'Polaco' },
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', demonym: 'Portugués' },
  { code: 'PRK', name: 'Corea del Norte', flag: '🇰🇵', demonym: 'Norcoreano' },
  { code: 'ROU', name: 'Rumanía', flag: '🇷🇴', demonym: 'Rumano' },
  { code: 'RSA', name: 'Sudáfrica', flag: '🇿🇦', demonym: 'Sudafricano' },
  { code: 'SRB', name: 'Serbia', flag: '🇷🇸', demonym: 'Serbio' },
  { code: 'SUI', name: 'Suiza', flag: '🇨🇭', demonym: 'Suizo' },
  { code: 'SWE', name: 'Suecia', flag: '🇸🇪', demonym: 'Sueco' },
  { code: 'THA', name: 'Tailandia', flag: '🇹🇭', demonym: 'Tailandés' },
  { code: 'TUR', name: 'Turquía', flag: '🇹🇷', demonym: 'Turco' },
  { code: 'UKR', name: 'Ucrania', flag: '🇺🇦', demonym: 'Ucraniano' },
  { code: 'URU', name: 'Uruguay', flag: '🇺🇾', demonym: 'Uruguayo' },
  { code: 'VEN', name: 'Venezuela', flag: '🇻🇪', demonym: 'Venezolano' },
  { code: 'UAE', name: 'Emiratos Árabes Unidos', flag: '🇦🇪', demonym: 'Emiratí' },
  { code: 'GBR', name: 'Reino Unido', flag: '🇬🇧', demonym: 'Británico' },
];

const BY_CODE = new Map();
for (const c of COUNTRIES) if (!BY_CODE.has(c.code)) BY_CODE.set(c.code, c);

function countryByCode(code) {
  return BY_CODE.get(code) || { code: 'INT', name: 'Internacional', flag: '🏳️', demonym: 'Internacional' };
}

function countryFlag(code) {
  return countryByCode(code).flag;
}

function countryName(code) {
  return countryByCode(code).name;
}

/** Países ordenados alfabéticamente, sin duplicados de demostración. */
const COUNTRY_LIST = (() => {
  const seen = new Set();
  const out = [];
  for (const c of COUNTRIES) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    out.push(c);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'));
})();

/* ─────────── Paleta de cascos: colores solidsoul + combinaciones clásicas ─────────── */

const HELMET_COLORS = [
  { id: 'rojo', name: 'Rojo', primary: '#e8112d', secondary: '#ffffff' },
  { id: 'blanco', name: 'Blanco', primary: '#f4f6fb', secondary: '#101318' },
  { id: 'negro', name: 'Negro', primary: '#12141a', secondary: '#e8112d' },
  { id: 'azul', name: 'Azul', primary: '#1560bd', secondary: '#f4f6fb' },
  { id: 'celeste', name: 'Celeste', primary: '#4fc3f7', secondary: '#0a1c2b' },
  { id: 'verde', name: 'Verde', primary: '#12a37a', secondary: '#f4f6fb' },
  { id: 'amarillo', name: 'Amarillo', primary: '#ffd100', secondary: '#141414' },
  { id: 'naranja', name: 'Naranja', primary: '#ff7a00', secondary: '#101318' },
  { id: 'morado', name: 'Morado', primary: '#7b3ff2', secondary: '#ffd100' },
  { id: 'rosa', name: 'Rosa', primary: '#ff4fd8', secondary: '#0a0d18' },
  { id: 'turquesa', name: 'Turquesa', primary: '#00d2a0', secondary: '#0b1a2b' },
  { id: 'dorado', name: 'Dorado', primary: '#c9a227', secondary: '#1a1508' },
  { id: 'gris', name: 'Gris', primary: '#b6babd', secondary: '#0a0d16' },
  { id: 'marrón', name: 'Marrón', primary: '#7a4a22', secondary: '#e8d8b0' },
];

const HELMET_SKINS = [
  { id: 'cascara', name: 'Cáscara', primary: '#e0b088', secondary: '#8a5a2b' },
  { id: 'rayas', name: 'Rayas', primary: '#ffffff', secondary: '#e8112d' },
  { id: 'pista', name: 'Pista', primary: '#101318', secondary: '#f4f6fb' },
  { id: 'franjas', name: 'Franjas', primary: '#1560bd', secondary: '#f4f6fb' },
  { id: 'sol', name: 'Sol', primary: '#ffd100', secondary: '#e8112d' },
  { id: 'bisonte', name: 'Bisón', primary: '#7a4a22', secondary: '#f4f6fb' },
  { id: 'estrella', name: 'Estrella', primary: '#0a1c2b', secondary: '#f4f6fb' },
  { id: 'llama', name: 'Llama', primary: '#00d2a0', secondary: '#101318' },
];

/* ─────────── Validación de edad: 17 a 60 años ─────────── */

const MIN_AGE = 17;
const MAX_AGE = 60;

function ageAt(birthIso, onIso) {
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [oy, om, od] = (onIso || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age -= 1;
  return age;
}

function validateBirth(birthIso, seasonStartIso = '2026-03-05') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthIso || ''))) {
    return { ok: false, error: 'Introduce una fecha válida.' };
  }
  const [y] = birthIso.split('-').map(Number);
  const nowYear = Number(seasonStartIso.slice(0, 4));
  if (y < nowYear - MAX_AGE || y > nowYear - MIN_AGE) {
    return { ok: false, error: `Para correr en 2026 hay que tener entre ${MIN_AGE} y ${MAX_AGE} años.` };
  }
  const age = ageAt(birthIso, seasonStartIso);
  if (age < MIN_AGE) return { ok: false, error: `Aún no cumples los ${MIN_AGE} años el inicio de la temporada.` };
  if (age > MAX_AGE) return { ok: false, error: `Has superado el límite de ${MAX_AGE} años.` };
  return { ok: true, age };
}

  __x.COUNTRIES = COUNTRIES;
  __x.countryByCode = countryByCode;
  __x.countryFlag = countryFlag;
  __x.countryName = countryName;
  __x.COUNTRY_LIST = COUNTRY_LIST;
  __x.HELMET_COLORS = HELMET_COLORS;
  __x.HELMET_SKINS = HELMET_SKINS;
  __x.MIN_AGE = MIN_AGE;
  __x.MAX_AGE = MAX_AGE;
  __x.ageAt = ageAt;
  __x.validateBirth = validateBirth;
};
__registry["js/data/drivers.js"] = function (__x, __req) {
﻿// Parrilla 2026: 22 pilotos de Fórmula 1 y 22 de Fórmula 2.
// Nombres, dorsales y equipos corresponden a la temporada 2026.

const r = (pace, braking, control, consistency, racecraft, quali, tyre, starts, wet) => ({
  pace,
  braking,
  control,
  consistency,
  racecraft,
  quali,
  tyre,
  starts,
  wet,
});

const F1_DRIVERS = [
  { id: 'norris', name: 'Lando Norris', short: 'NOR', code: 'NOR', number: 1, country: 'GBR', flag: '🇬🇧', teamId: 'mclaren', age: 26, helmet: { primary: '#ff8700', secondary: '#0b1a3a' }, ratings: r(96, 93, 92, 92, 92, 95, 91, 88, 88), traits: ['Rápido en clasificación', 'Frenada tardía'] },
  { id: 'piastri', name: 'Óscar Piastri', short: 'PIA', code: 'PIA', number: 81, country: 'AUS', flag: '🇦🇺', teamId: 'mclaren', age: 25, helmet: { primary: '#ff8700', secondary: '#121a3d' }, ratings: r(94, 95, 95, 94, 90, 94, 93, 86, 90), traits: ['Frío', 'Frenada brutal'] },
  { id: 'hamilton', name: 'Lewis Hamilton', short: 'HAM', code: 'HAM', number: 44, country: 'GBR', flag: '🇬🇧', teamId: 'ferrari', age: 41, helmet: { primary: '#00d2a0', secondary: '#e8112d' }, ratings: r(96, 97, 95, 90, 94, 95, 94, 97, 94), traits: ['Maestro de la gestión', 'Neumáticos salvadores'] },
  { id: 'leclerc', name: 'Charles Leclerc', short: 'LEC', code: 'LEC', number: 16, country: 'MON', flag: '🇲🇨', teamId: 'ferrari', age: 29, helmet: { primary: '#e8112d', secondary: '#15161c' }, ratings: r(95, 94, 93, 88, 91, 96, 90, 88, 86), traits: ['Récord en clasificación', 'Polémica en pista'] },
  { id: 'russell', name: 'George Russell', short: 'RUS', code: 'RUS', number: 63, country: 'GBR', flag: '🇬🇧', teamId: 'mercedes', age: 32, helmet: { primary: '#00d2a0', secondary: '#0a1c2b' }, ratings: r(93, 93, 92, 91, 92, 94, 92, 90, 89), traits: ['Ingeniero de pista', 'Militar'] },
  { id: 'antonelli', name: 'Kimi Antonelli', short: 'ANT', code: 'ANT', number: 12, country: 'ITA', flag: '🇮🇹', teamId: 'mercedes', age: 19, helmet: { primary: '#00d2a0', secondary: '#f5d000' }, ratings: r(92, 90, 89, 85, 88, 92, 87, 84, 84), traits: ['Aprendizaje rápido', 'Racha de victorias'] },
  { id: 'verstappen', name: 'Max Verstappen', short: 'VER', code: 'VER', number: 3, country: 'NED', flag: '🇳🇱', teamId: 'redbull', age: 29, helmet: { primary: '#1b3b8f', secondary: '#f5d000' }, ratings: r(98, 97, 96, 89, 95, 95, 92, 95, 92), traits: ['Máquina de carrera', 'Duro con el rival'] },
  { id: 'hadjar', name: 'Isack Hadjar', short: 'HAD', code: 'HAD', number: 6, country: 'FRA', flag: '🇫🇷', teamId: 'redbull', age: 26, helmet: { primary: '#1b3b8f', secondary: '#e8112d' }, ratings: r(88, 87, 87, 87, 86, 88, 86, 85, 85), traits: ['Presión de la academia', 'Tranquilo'] },
  { id: 'alonso', name: 'Fernando Alonso', short: 'ALO', code: 'ALO', number: 14, country: 'ESP', flag: '🇪🇸', teamId: 'aston', age: 45, helmet: { primary: '#1f6f4a', secondary: '#d8f0e4' }, ratings: r(90, 91, 93, 93, 96, 90, 95, 97, 94), traits: ['Oveja negra', 'Defiende posiciones'] },
  { id: 'stroll', name: 'Lance Stroll', short: 'STRO', code: 'STR', number: 18, country: 'CAN', flag: '🇨🇦', teamId: 'aston', age: 27, helmet: { primary: '#1f6f4a', secondary: '#c8102e' }, ratings: r(82, 82, 80, 78, 76, 82, 79, 74, 78), traits: ['Presión permanente', 'Malas salidas'] },
  { id: 'gasly', name: 'Pierre Gasly', short: 'GAS', code: 'GAS', number: 10, country: 'FRA', flag: '🇫🇷', teamId: 'alpine', age: 30, helmet: { primary: '#ff7ac8', secondary: '#1230c8' }, ratings: r(88, 88, 87, 86, 87, 88, 86, 86, 86), traits: ['Especialista en poles', 'Fuerte con la lluvia'] },
  { id: 'colapinto', name: 'Franco Colapinto', short: 'COL', code: 'COL', number: 43, country: 'ARG', flag: '🇦🇷', teamId: 'alpine', age: 23, helmet: { primary: '#ff7ac8', secondary: '#0a0d18' }, ratings: r(83, 83, 82, 80, 81, 84, 81, 79, 82), traits: ['Coraje', 'Sin miedo'] },
  { id: 'albon', name: 'Alexander Albon', short: 'ALB', code: 'ALB', number: 23, country: 'THA', flag: '🇹🇭', teamId: 'williams', age: 30, helmet: { primary: '#1868db', secondary: '#0a1f4d' }, ratings: r(87, 87, 88, 89, 88, 87, 90, 89, 88), traits: ['Gestor de gomas', 'Fiel al equipo'] },
  { id: 'sainz', name: 'Carlos Sainz', short: 'SAI', code: 'SAI', number: 55, country: 'ESP', flag: '🇪🇸', teamId: 'williams', age: 37, helmet: { primary: '#1868db', secondary: '#00d2a0' }, ratings: r(89, 90, 90, 92, 91, 90, 92, 92, 90), traits: ['Ingeniero de carrera', 'Campeón con varios equipos'] },
  { id: 'lawson', name: 'Liam Lawson', short: 'LAW', code: 'LAW', number: 30, country: 'NZL', flag: '🇳🇿', teamId: 'racingbulls', age: 24, helmet: { primary: '#6a4df0', secondary: '#1fd7c3' }, ratings: r(85, 84, 84, 82, 82, 85, 83, 82, 82), traits: ['Agresivo', 'Buen debrief'] },
  { id: 'lindblad', name: 'Arvid Lindblad', short: 'LIN', code: 'LIN', number: 41, country: 'GBR', flag: '🇬🇧', teamId: 'racingbulls', age: 19, helmet: { primary: '#6a4df0', secondary: '#f5d000' }, ratings: r(84, 82, 80, 77, 80, 85, 79, 78, 79), traits: ['Novato atolondrado', 'Debut en F1'] },
  { id: 'bearman', name: 'Oliver Bearman', short: 'BEA', code: 'BEA', number: 87, country: 'GBR', flag: '🇬🇧', teamId: 'haas', age: 26, helmet: { primary: '#b6babd', secondary: '#0a0d16' }, ratings: r(83, 82, 83, 83, 82, 84, 82, 82, 83), traits: ['En casa es otra historia', 'Gran fin de semana'] },
  { id: 'ocon', name: 'Esteban Ocon', short: 'OCO', code: 'OCO', number: 31, country: 'FRA', flag: '🇫🇷', teamId: 'haas', age: 30, helmet: { primary: '#b6babd', secondary: '#e8112d' }, ratings: r(82, 82, 81, 80, 81, 82, 80, 80, 80), traits: ['Combativo', 'Túnel de boxes'] },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', short: 'BOR', code: 'BOR', number: 5, country: 'BRA', flag: '🇧🇷', teamId: 'audi', age: 22, helmet: { primary: '#f22f27', secondary: '#1b1b1f' }, ratings: r(79, 79, 80, 79, 79, 80, 78, 78, 79), traits: ['Campeón de F3', 'Método'] },
  { id: 'hulkenberg', name: 'Nico Hülkenberg', short: 'HUL', code: 'HUL', number: 27, country: 'GER', flag: '🇩🇪', teamId: 'audi', age: 53, helmet: { primary: '#f22f27', secondary: '#e8e8ea' }, ratings: r(83, 83, 82, 82, 84, 84, 84, 84, 83), traits: ['Récord de poles', 'Nunca en el podio'] },
  { id: 'bottas', name: 'Valtteri Bottas', short: 'BOT', code: 'BOT', number: 88, country: 'FIN', flag: '🇫🇮', teamId: 'cadillac', age: 36, helmet: { primary: '#0a2540', secondary: '#d8dde6' }, ratings: r(84, 84, 85, 85, 84, 85, 86, 89, 84), traits: ['Ingeniería de pista', 'Pole en 2019'] },
  { id: 'perez', name: 'Sergio Pérez', short: 'PER', code: 'PER', number: 11, country: 'MEX', flag: '🇲🇽', teamId: 'cadillac', age: 36, helmet: { primary: '#0a2540', secondary: '#e8112d' }, ratings: r(84, 84, 83, 82, 85, 85, 88, 88, 84), traits: ['Experiencia en gestión', 'Remontadas de noche'] },
];

const F2_DRIVERS = [
  { id: 'camara', name: 'Rafael Câmara', short: 'CAM', code: 'CAM', number: 1, country: 'BRA', flag: '🇧🇷', teamId: 'invicta', age: 23, helmet: { primary: '#1f4fd8', secondary: '#e8112d' }, ratings: r(84, 83, 83, 82, 81, 83, 82, 80, 82), traits: ['Campeón invicto', 'Constante'] },
  { id: 'duerksen', name: 'Joshua Dürksen', short: 'DUE', code: 'DUE', number: 2, country: 'LUX', flag: '🇱🇺', teamId: 'invicta', age: 23, helmet: { primary: '#1f4fd8', secondary: '#00d2a0' }, ratings: r(83, 82, 82, 81, 80, 82, 81, 79, 81), traits: ['Rivale interno', 'Rápido en trazadas largas'] },
  { id: 'miyata', name: 'Ritomo Miyata', short: 'MIY', code: 'MIY', number: 3, country: 'JPN', flag: '🇯🇵', teamId: 'hitech', age: 21, helmet: { primary: '#00b3a4', secondary: '#f5d000' }, ratings: r(80, 80, 80, 79, 78, 80, 79, 78, 79), traits: ['Academia Toyota', 'Debutante'] },
  { id: 'herta', name: 'Colton Herta', short: 'HER', code: 'HER', number: 4, country: 'USA', flag: '🇺🇸', teamId: 'hitech', age: 26, helmet: { primary: '#00b3a4', secondary: '#f5d000' }, ratings: r(83, 82, 82, 81, 83, 83, 81, 84, 81), traits: ['Experiencia en IndyCar', 'Duro con el rival'] },
  { id: 'leon', name: 'Noel León', short: 'LEO', code: 'LEO', number: 5, country: 'ESP', flag: '🇪🇸', teamId: 'campos', age: 22, helmet: { primary: '#1a7a3c', secondary: '#e8112d' }, ratings: r(80, 80, 80, 80, 79, 80, 80, 78, 79), traits: ['Polivalente', 'Buen carácter'] },
  { id: 'tsolov', name: 'Nikola Tsolov', short: 'TSO', code: 'TSO', number: 6, country: 'BUL', flag: '🇧🇬', teamId: 'campos', age: 22, helmet: { primary: '#1a7a3c', secondary: '#f5d000' }, ratings: r(81, 81, 81, 81, 80, 81, 81, 80, 80), traits: ['Mano suave', 'Trazada técnica'] },
  { id: 'beganovic', name: 'Dino Beganovic', short: 'BEG', code: 'BEG', number: 7, country: 'SVN', flag: '🇸🇮', teamId: 'dams', age: 21, helmet: { primary: '#ffd100', secondary: '#141414' }, ratings: r(81, 81, 81, 80, 80, 81, 80, 79, 80), traits: ['Academia Ferrari', 'Constante'] },
  { id: 'bilinski', name: 'Roman Bilinski', short: 'BIL', code: 'BIL', number: 8, country: 'POL', flag: '🇵🇱', teamId: 'dams', age: 23, helmet: { primary: '#ffd100', secondary: '#1560bd' }, ratings: r(78, 78, 79, 79, 78, 79, 79, 78, 78), traits: ['Firme', 'Sin errores'] },
  { id: 'mini', name: 'Gabriele Minì', short: 'MIN', code: 'MIN', number: 9, country: 'ITA', flag: '🇮🇹', teamId: 'mp', age: 20, helmet: { primary: '#ff7a00', secondary: '#111820' }, ratings: r(83, 82, 82, 81, 82, 83, 82, 80, 81), traits: ['Campeón de F3', 'Velocidad en recta'] },
  { id: 'goethe', name: 'Oliver Goethe', short: 'GOE', code: 'GOE', number: 10, country: 'DE', flag: '🇩🇪', teamId: 'mp', age: 21, helmet: { primary: '#ff7a00', secondary: '#00d2a0' }, ratings: r(79, 79, 79, 78, 78, 79, 78, 77, 78), traits: ['Escuela alemana', 'Metódico'] },
  { id: 'montoya', name: 'Sebastián Montoya', short: 'MON', code: 'MON', number: 11, country: 'COL', flag: '🇨🇴', teamId: 'prema', age: 21, helmet: { primary: '#e8112d', secondary: '#f5d000' }, ratings: r(79, 79, 80, 79, 78, 80, 79, 78, 79), traits: ['Tardío al frenar', 'Rápido en F3'] },
  { id: 'boya', name: 'Mari Boya', short: 'BOY', code: 'BOY', number: 12, country: 'ESP', flag: '🇪🇸', teamId: 'prema', age: 20, helmet: { primary: '#e8112d', secondary: '#101014' }, ratings: r(80, 80, 80, 79, 79, 80, 80, 78, 79), traits: ['Constancia', 'Sin dramas'] },
  { id: 'stenshorne', name: 'Martinius Stenshorne', short: 'STE', code: 'STE', number: 14, country: 'NOR', flag: '🇳🇴', teamId: 'rodin', age: 20, helmet: { primary: '#12a37a', secondary: '#f5d000' }, ratings: r(77, 77, 78, 77, 77, 78, 77, 76, 77), traits: ['Joven', 'Curioso'] },
  { id: 'dunne', name: 'Alexander Dunne', short: 'DUN', code: 'DUN', number: 15, country: 'IRL', flag: '🇮🇪', teamId: 'rodin', age: 21, helmet: { primary: '#12a37a', secondary: '#0b1c16' }, ratings: r(86, 85, 85, 84, 83, 85, 84, 82, 84), traits: ['Favorito al título', 'Trazada limpia'] },
  { id: 'maini', name: 'Kush Maini', short: 'MAI', code: 'MAI', number: 16, country: 'IND', flag: '🇮🇳', teamId: 'art', age: 21, helmet: { primary: '#5b2d8e', secondary: '#ff4fd8' }, ratings: r(80, 80, 80, 79, 79, 81, 79, 78, 80), traits: ['Velocidad en F3', 'Agresivo'] },
  { id: 'inthraphuvasak', name: 'Tasanapol Inthraphuvasak', short: 'INT', code: 'INT', number: 17, country: 'THA', flag: '🇹🇭', teamId: 'art', age: 22, helmet: { primary: '#5b2d8e', secondary: '#120b22' }, ratings: r(76, 76, 77, 77, 76, 77, 76, 75, 76), traits: ['Academia Alpine', 'Disciplinado'] },
  { id: 'fittipaldi', name: 'Emerson Fittipaldi', short: 'FIT', code: 'FIT', number: 20, country: 'BRA', flag: '🇧🇷', teamId: 'aix', age: 19, helmet: { primary: '#00c2a8', secondary: '#ff4f00' }, ratings: r(77, 77, 78, 77, 77, 78, 77, 76, 77), traits: ['Sangre nueva', 'Nombre con peso'] },
  { id: 'shields', name: 'Cian Shields', short: 'SHI', code: 'SHI', number: 21, country: 'IRL', flag: '🇮🇪', teamId: 'aix', age: 21, helmet: { primary: '#00c2a8', secondary: '#0a1a1e' }, ratings: r(75, 75, 76, 76, 75, 76, 75, 75, 75), traits: ['Aprendiz', 'Constante'] },
  { id: 'varrone', name: 'Nico Varrone', short: 'VAR', code: 'VAR', number: 22, country: 'ITA', flag: '🇮🇹', teamId: 'var', age: 21, helmet: { primary: '#f2f4f8', secondary: '#101418' }, ratings: r(78, 78, 79, 78, 78, 78, 78, 77, 78), traits: ['Italiano', 'Duro en la trazada'] },
  { id: 'villagomez', name: 'Rafael Villagómez', short: 'VIL', code: 'VIL', number: 23, country: 'MEX', flag: '🇲🇽', teamId: 'var', age: 23, helmet: { primary: '#f2f4f8', secondary: '#1560bd' }, ratings: r(76, 76, 77, 77, 76, 77, 76, 76, 76), traits: ['Veterano de la categoría', 'Táctico'] },
  { id: 'vanhoepen', name: 'Laurens van Hoepen', short: 'VHO', code: 'VHO', number: 24, country: 'NED', flag: '🇳🇱', teamId: 'trident', age: 22, helmet: { primary: '#123a8f', secondary: '#00d2a0' }, ratings: r(75, 75, 76, 76, 75, 76, 75, 75, 75), traits: ['Neerlandés', 'Tranquilo'] },
  { id: 'bennett', name: 'John Bennett', short: 'BEN', code: 'BEN', number: 25, country: 'USA', flag: '🇺🇸', teamId: 'trident', age: 21, helmet: { primary: '#123a8f', secondary: '#0a1020' }, ratings: r(77, 77, 78, 77, 77, 78, 77, 76, 77), traits: ['Universidad de Indiana', 'Curioso'] },
];

const NATIONALITIES = {
  GBR: 'Británico',
  USA: 'Estadounidense',
  AUS: 'Australiano',
  ITA: 'Italiano',
  MON: 'Monegasco',
  DEU: 'Alemán',
  DE: 'Alemán',
  NED: 'Neerlandés',
  FRA: 'Francés',
  ESP: 'Español',
  CAN: 'Canadiense',
  THA: 'Tailandés',
  NZL: 'Neozelandés',
  BRA: 'Brasileño',
  MEX: 'Mexicano',
  ARG: 'Argentino',
  FIN: 'Finés',
  SUI: 'Suizo',
  BEL: 'Belga',
  LUX: 'Luxemburgués',
  JPN: 'Japonés',
  BUL: 'Búlgaro',
  SVN: 'Esloveno',
  POL: 'Polaco',
  COL: 'Colombiano',
  IRL: 'Irlandés',
  NOR: 'Noruego',
  IND: 'Indio',
  AUT: 'Austríaco',
};

const F1_BY_ID = new Map(F1_DRIVERS.map((d) => [d.id, d]));
const F2_BY_ID = new Map(F2_DRIVERS.map((d) => [d.id, d]));

function driversFor(series) {
  return series === 'f2' ? F2_DRIVERS : F1_DRIVERS;
}

function findDriver(id, series = 'f1') {
  return (series === 'f2' ? F2_BY_ID : F1_BY_ID).get(id) || null;
}

function driverNationality(d) {
  return NATIONALITIES[d.country] || d.country;
}

/** Media ponderada de atributos: base del OVR de la IA y del jugador. */
function averageRating(ratings) {
  const weights = { pace: 1.35, braking: 1.1, control: 1.15, consistency: 1.2, racecraft: 1.05, quali: 1.1, tyre: 0.95, starts: 0.7, wet: 0.6 };
  let total = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(ratings)) {
    const w = weights[key] ?? 1;
    total += value * w;
    weight += w;
  }
  return Math.round(total / weight);
}

const F1_NUMBERS = F1_DRIVERS.map((d) => d.number);

  __x.F1_DRIVERS = F1_DRIVERS;
  __x.F2_DRIVERS = F2_DRIVERS;
  __x.NATIONALITIES = NATIONALITIES;
  __x.driversFor = driversFor;
  __x.findDriver = findDriver;
  __x.driverNationality = driverNationality;
  __x.averageRating = averageRating;
  __x.F1_NUMBERS = F1_NUMBERS;
};
__registry["js/data/teams.js"] = function (__x, __req) {
// Los 11 equipos de Fórmula 1 de la temporada 2026 y los 11 de Fórmula 2.
// Los colores son aproximaciones a partir de la decoración de cada escudería.

const F1_TEAMS = [
  {
    id: 'mclaren',
    name: 'McLaren',
    code: 'MCL',
    fullName: 'McLaren Mastercard Formula 1 Team',
    country: 'GBR',
    flag: '🇬🇧',
    hq: 'Woking, Inglaterra',
    founded: 1963,
    titles: 9,
    engine: 'Mercedes',
    tier: 1,
    livery: { primary: '#ff8700', secondary: '#0b1a3a', accent: '#00d2a0', style: 'papaya' },
    car: { power: 95, aero: 96, grip: 94, brakes: 95, reliability: 92, budget: 168 },
    staff: {
      principal: { name: 'Andrea Stella', style: 'exigente', flag: '🇮🇹' },
      deputy: { name: 'Zak Brown', style: 'ambicioso', flag: '🇺🇸' },
      chiefMechanic: { name: 'Gilberto de la Fuente', style: 'práctico', flag: '🇲🇽' },
      raceEngineer: { name: 'Will Marshall', style: 'analítico', flag: '🇬🇧' },
      performance: { name: 'Dave Charman', style: 'exigente', flag: '🇬🇧' },
    },
    motto: 'Ganar con rapidez y con estilo.',
  },
  {
    id: 'ferrari',
    name: 'Ferrari',
    code: 'FER',
    fullName: 'Scuderia Ferrari',
    country: 'ITA',
    flag: '🇮🇹',
    hq: 'Maranello, Italia',
    founded: 1929,
    titles: 16,
    engine: 'Ferrari',
    tier: 1,
    livery: { primary: '#e8112d', secondary: '#f5d000', accent: '#15161c', style: 'italian' },
    car: { power: 96, aero: 95, grip: 94, brakes: 94, reliability: 90, budget: 172 },
    staff: {
      principal: { name: 'Frédéric Vasseur', style: 'calculador', flag: '🇫🇷' },
      deputy: { name: 'Laurent Kebous', style: 'técnico', flag: '🇧🇪' },
      chiefMechanic: { name: 'Riccardo Crucino', style: 'tradicional', flag: '🇮🇹' },
      raceEngineer: { name: 'Bryan Bozzi', style: 'detallista', flag: '🇫🇷' },
      performance: { name: 'Andrea De Cesaro', style: 'analítico', flag: '🇮🇹' },
    },
    motto: 'El rojo más rápido del mundo.',
  },
  {
    id: 'mercedes',
    name: 'Mercedes',
    code: 'MER',
    fullName: 'Mercedes-AMG PETRONAS Formula One Team',
    country: 'DEU',
    flag: '🇩🇪',
    hq: 'Brackley, Inglaterra',
    founded: 2010,
    titles: 9,
    engine: 'Mercedes',
    tier: 1,
    livery: { primary: '#00d2a0', secondary: '#0a1c2b', accent: '#d9fbf2', style: 'petronas' },
    car: { power: 97, aero: 95, grip: 93, brakes: 94, reliability: 91, budget: 170 },
    staff: {
      principal: { name: 'Toto Wolff', style: 'estratéga', flag: '🇦🇹' },
      deputy: { name: 'James Dow', style: 'organizado', flag: '🇬🇧' },
      chiefMechanic: { name: 'James Matthews', style: 'metódico', flag: '🇬🇧' },
      raceEngineer: { name: 'Chris Medland', style: 'relajado', flag: '🇬🇧' },
      performance: { name: 'Rob Killian', style: 'analítico', flag: '🇮🇪' },
    },
    motto: 'Una leyenda que se reescribe cada fin de semana.',
  },
  {
    id: 'redbull',
    name: 'Red Bull Racing',
    code: 'RBR',
    fullName: 'Oracle Red Bull Racing Ford',
    country: 'AUT',
    flag: '🇦🇹',
    hq: 'Milton Keynes, Inglaterra',
    founded: 2005,
    titles: 6,
    engine: 'Ford',
    tier: 1,
    livery: { primary: '#1b3b8f', secondary: '#f5d000', accent: '#e8112d', style: 'navy' },
    car: { power: 94, aero: 95, grip: 94, brakes: 93, reliability: 90, budget: 168 },
    staff: {
      principal: { name: 'Laurent Mekies', style: 'intenso', flag: '🇫🇷' },
      deputy: { name: 'Horst Saibold', style: 'veterano', flag: '🇦🇹' },
      chiefMechanic: { name: 'Steve Nielsen', style: 'exigente', flag: '🇩🇰' },
      raceEngineer: { name: 'Paul Rogers', style: 'práctico', flag: '🇬🇧' },
      performance: { name: 'Gunnar Nørgaard', style: 'analítico', flag: '🇩🇰' },
    },
    motto: 'Todo está predestinado… pero se gana en la pista.',
  },
  {
    id: 'aston',
    name: 'Aston Martin',
    code: 'AST',
    fullName: 'Aston Martin Aramco Formula One Team',
    country: 'GBR',
    flag: '🇬🇧',
    hq: 'Silverstone, Inglaterra',
    founded: 2017,
    titles: 0,
    engine: 'Mercedes',
    tier: 2,
    livery: { primary: '#1f6f4a', secondary: '#d8f0e4', accent: '#c8102e', style: 'british' },
    car: { power: 91, aero: 90, grip: 90, brakes: 90, reliability: 88, budget: 148 },
    staff: {
      principal: { name: 'Enzo Deti', style: 'apasionado', flag: '🇮🇹' },
      deputy: { name: 'Andy Cowell', style: 'técnico', flag: '🇬🇧' },
      chiefMechanic: { name: 'Marek Seitz', style: 'cercano', flag: '🇩🇪' },
      raceEngineer: { name: 'Jack Millar', style: 'detallista', flag: '🇬🇧' },
      performance: { name: 'Bernie Collins', style: 'analítico', flag: '🇨🇦' },
    },
    motto: 'El verde que rompe con el escudo histórico de Aston Martin.',
  },
  {
    id: 'alpine',
    name: 'Alpine',
    code: 'ALP',
    fullName: 'BWT Alpine Formula One Team',
    country: 'FRA',
    flag: '🇫🇷',
    hq: 'Enstone, Inglaterra',
    founded: 2016,
    titles: 0,
    engine: 'Mercedes',
    tier: 2,
    livery: { primary: '#ff7ac8', secondary: '#1230c8', accent: '#0a0d18', style: 'alpine' },
    car: { power: 90, aero: 91, grip: 90, brakes: 89, reliability: 89, budget: 146 },
    staff: {
      principal: { name: 'Flavio Briatore', style: 'político', flag: '🇮🇹' },
      deputy: { name: 'Gunnar Stein', style: 'práctico', flag: '🇩🇪' },
      chiefMechanic: { name: 'Giorgio Scarano', style: 'duro', flag: '🇮🇹' },
      raceEngineer: { name: 'Pierre Lacroix', style: 'analítico', flag: '🇫🇷' },
      performance: { name: 'Alan Munday', style: 'analítico', flag: '🇬🇧' },
    },
    motto: 'Alternativa y persistente, sin techo.',
  },
  {
    id: 'williams',
    name: 'Williams',
    code: 'WIL',
    fullName: 'Atlassian Williams F1 Team',
    country: 'GBR',
    flag: '🇬🇧',
    hq: 'Grove, Inglaterra',
    founded: 1977,
    titles: 9,
    engine: 'Mercedes',
    tier: 2,
    livery: { primary: '#1868db', secondary: '#0a1f4d', accent: '#00d2a0', style: 'blue' },
    car: { power: 90, aero: 89, grip: 88, brakes: 88, reliability: 86, budget: 138 },
    staff: {
      principal: { name: 'Jenson Button', style: 'inspirador', flag: '🇬🇧' },
      deputy: { name: 'Vince Gardner', style: 'cercano', flag: '🇦🇺' },
      chiefMechanic: { name: 'Dave Hutsby', style: 'práctico', flag: '🇬🇧' },
      raceEngineer: { name: 'Freddie Houghton', style: 'analítico', flag: '🇬🇧' },
      performance: { name: 'Gareth Dicker', style: 'analítico', flag: '🇬🇧' },
    },
    motto: 'Construir desde la base, ganar desde el paddock.',
  },
  {
    id: 'racingbulls',
    name: 'Racing Bulls',
    code: 'RBS',
    fullName: 'Visa Cash App Racing Bulls Formula One Team',
    country: 'ITA',
    flag: '🇮🇹',
    hq: 'Faenza, Italia',
    founded: 1985,
    titles: 0,
    engine: 'Ford',
    tier: 3,
    livery: { primary: '#6a4df0', secondary: '#0b0d16', accent: '#1fd7c3', style: 'bull' },
    car: { power: 88, aero: 88, grip: 88, brakes: 87, reliability: 88, budget: 128 },
    staff: {
      principal: { name: 'Alessandro Albon', style: 'directo', flag: '🇹🇭' },
      deputy: { name: 'Graziano Baldini', style: 'veterano', flag: '🇮🇹' },
      chiefMechanic: { name: 'Luca Bassi', style: 'cercano', flag: '🇮🇹' },
      raceEngineer: { name: 'Emanuele Haddad', style: 'analítico', flag: '🇮🇹' },
      performance: { name: 'Gian Piovesana', style: 'analítico', flag: '🇮🇹' },
    },
    motto: 'Joven, valiente y con cero miedo al gran premio.',
  },
  {
    id: 'haas',
    name: 'Haas',
    code: 'HAA',
    fullName: 'MoneyGram Haas F1 Team',
    country: 'USA',
    flag: '🇺🇸',
    hq: 'Staunton, Virginia',
    founded: 2016,
    titles: 0,
    engine: 'Ferrari',
    tier: 3,
    livery: { primary: '#b6babd', secondary: '#0a0d16', accent: '#e8112d', style: 'grey' },
    car: { power: 86, aero: 86, grip: 85, brakes: 85, reliability: 85, budget: 118 },
    staff: {
      principal: { name: 'David Grignon', style: 'pragmático', flag: '🇨🇦' },
      deputy: { name: 'Travis Baxter', style: 'cercano', flag: '🇨🇦' },
      chiefMechanic: { name: 'Randy Ertman', style: 'veterano', flag: '🇺🇸' },
      raceEngineer: { name: 'Rob Wainwright', style: 'analítico', flag: '🇬🇧' },
      performance: { name: 'Grant Engle', style: 'analítico', flag: '🇺🇸' },
    },
    motto: 'Prepárate y la ocasión llegará.',
  },
  {
    id: 'audi',
    name: 'Audi',
    code: 'AUD',
    fullName: 'Revolut Audi F1 Team',
    country: 'DEU',
    flag: '🇩🇪',
    hq: 'Neuburg an der Donau, Alemania',
    founded: 2026,
    titles: 0,
    engine: 'Audi',
    tier: 3,
    livery: { primary: '#f22f27', secondary: '#1b1b1f', accent: '#e8e8ea', style: 'rings' },
    car: { power: 84, aero: 85, grip: 85, brakes: 85, reliability: 80, budget: 122 },
    staff: {
      principal: { name: 'Gérard Ducarouge', style: 'técnico', flag: '🇫🇷' },
      deputy: { name: 'Ralf Kelleners', style: 'veterano', flag: '🇩🇪' },
      chiefMechanic: { name: 'Christian Fries', style: 'meticuloso', flag: '🇩🇪' },
      raceEngineer: { name: 'Mert Özer', style: 'analítico', flag: '🇹🇷' },
      performance: { name: 'Rob Mallen', style: 'analítico', flag: '🇺🇸' },
    },
    motto: 'Cien años de ingenio en un solo depósito.',
  },
  {
    id: 'cadillac',
    name: 'Cadillac',
    code: 'CAD',
    fullName: 'Cadillac Formula One Team',
    country: 'USA',
    flag: '🇺🇸',
    hq: 'Detroit, Michigan',
    founded: 2026,
    titles: 0,
    engine: 'GM',
    tier: 4,
    livery: { primary: '#0a2540', secondary: '#d8dde6', accent: '#e8112d', style: 'cadillac' },
    car: { power: 82, aero: 82, grip: 82, brakes: 83, reliability: 79, budget: 116 },
    staff: {
      principal: { name: 'TWG Motorsport', style: 'estratégico', flag: '🇺🇸' },
      deputy: { name: 'Jonathan Bell', style: 'práctico', flag: '🇬🇧' },
      chiefMechanic: { name: 'Sérgio Henriques', style: 'técnico', flag: '🇵🇹' },
      raceEngineer: { name: 'Charles Bacon', style: 'analítico', flag: '🇺🇸' },
      performance: { name: 'Mark McMillan', style: 'analítico', flag: '🇺🇸' },
    },
    motto: 'Debut con excepcionalismo americano.',
  },
];

const F2_TEAMS = [
  { id: 'invicta', name: 'Invicta Racing', code: 'INV', country: 'GBR', flag: '🇬🇧', livery: { primary: '#1f4fd8', secondary: '#0a1230', accent: '#e8112d', style: 'blue' }, car: { power: 93, aero: 92, grip: 92, brakes: 90, reliability: 90, budget: 96 } },
  { id: 'hitech', name: 'Hitech TGR', code: 'HIT', country: 'GBR', flag: '🇬🇧', livery: { primary: '#00b3a4', secondary: '#0a1c22', accent: '#f5d000', style: 'petronas' }, car: { power: 89, aero: 90, grip: 90, brakes: 89, reliability: 91, budget: 88 } },
  { id: 'campos', name: 'Campos Racing', code: 'CAM', country: 'ESP', flag: '🇪🇸', livery: { primary: '#1a7a3c', secondary: '#0a1c12', accent: '#e8112d', style: 'british' }, car: { power: 88, aero: 88, grip: 89, brakes: 88, reliability: 90, budget: 86 } },
  { id: 'dams', name: 'DAMS Lucas Oil', code: 'DAM', country: 'FRA', flag: '🇫🇷', livery: { primary: '#ffd100', secondary: '#141414', accent: '#1560bd', style: 'grey' }, car: { power: 88, aero: 87, grip: 88, brakes: 87, reliability: 90, budget: 85 } },
  { id: 'mp', name: 'MP Motorsport', code: 'MPM', country: 'NLD', flag: '🇳🇱', livery: { primary: '#ff7a00', secondary: '#111820', accent: '#00d2a0', style: 'papaya' }, car: { power: 87, aero: 87, grip: 87, brakes: 86, reliability: 89, budget: 84 } },
  { id: 'prema', name: 'PREMA Racing', code: 'PRM', country: 'ITA', flag: '🇮🇹', livery: { primary: '#e8112d', secondary: '#101014', accent: '#ffffff', style: 'italian' }, car: { power: 87, aero: 86, grip: 87, brakes: 86, reliability: 89, budget: 83 } },
  { id: 'rodin', name: 'Rodin Motorsport', code: 'ROD', country: 'GBR', flag: '🇬🇧', livery: { primary: '#12a37a', secondary: '#0b1c16', accent: '#f5d000', style: 'rings' }, car: { power: 86, aero: 86, grip: 86, brakes: 85, reliability: 88, budget: 82 } },
  { id: 'art', name: 'ART Grand Prix', code: 'ART', country: 'FRA', flag: '🇫🇷', livery: { primary: '#5b2d8e', secondary: '#120b22', accent: '#ff4fd8', style: 'bull' }, car: { power: 85, aero: 85, grip: 85, brakes: 84, reliability: 87, budget: 80 } },
  { id: 'aix', name: 'AIX Racing', code: 'AIX', country: 'ESP', flag: '🇪🇸', livery: { primary: '#00c2a8', secondary: '#0a1a1e', accent: '#ff4f00', style: 'rings' }, car: { power: 84, aero: 84, grip: 84, brakes: 83, reliability: 86, budget: 78 } },
  { id: 'var', name: 'Van Amersfoort Racing', code: 'VAR', country: 'NLD', flag: '🇳🇱', livery: { primary: '#f2f4f8', secondary: '#101418', accent: '#1560bd', style: 'grey' }, car: { power: 84, aero: 83, grip: 84, brakes: 83, reliability: 87, budget: 77 } },
  { id: 'trident', name: 'TRIDENT', code: 'TRI', country: 'GBR', flag: '🇬🇧', livery: { primary: '#123a8f', secondary: '#0a1020', accent: '#00d2a0', style: 'blue' }, car: { power: 83, aero: 83, grip: 83, brakes: 82, reliability: 86, budget: 76 } },
];

const F2_STAFF = {
  invicta: { principal: { name: 'Sacha Modena', style: 'ambicioso', flag: '🇮🇹' }, chiefMechanic: { name: 'Tom Bishop', style: 'práctico', flag: '🇬🇧' }, raceEngineer: { name: 'Arnaud Lemoine', style: 'analítico', flag: '🇫🇷' } },
  hitech: { principal: { name: 'Oliver Oakes', style: 'calculador', flag: '🇬🇧' }, chiefMechanic: { name: 'Diego Rueda', style: 'cercano', flag: '🇪🇸' }, raceEngineer: { name: 'Nils Bauer', style: 'analítico', flag: '🇩🇪' } },
  campos: { principal: { name: 'Julio Iñiguez', style: 'cercano', flag: '🇪🇸' }, chiefMechanic: { name: 'Marc Prieto', style: 'práctico', flag: '🇪🇸' }, raceEngineer: { name: 'Ana Beltrán', style: 'analítico', flag: '🇪🇸' } },
  dams: { principal: { name: 'Guy Savage', style: 'veterano', flag: '🇬🇧' }, chiefMechanic: { name: 'Aurélien Mercier', style: 'práctico', flag: '🇫🇷' }, raceEngineer: { name: 'Lucie Marchand', style: 'analítico', flag: '🇫🇷' } },
  mp: { principal: { name: 'Sander van der Marel', style: 'práctico', flag: '🇳🇱' }, chiefMechanic: { name: 'Hugo Visser', style: 'cercano', flag: '🇳🇱' }, raceEngineer: { name: 'Eva Kraan', style: 'analítico', flag: '🇳🇱' } },
  prema: { principal: { name: 'Angelo Rosin', style: 'resolutivo', flag: '🇮🇹' }, chiefMechanic: { name: 'Dario Ferraro', style: 'práctico', flag: '🇮🇹' }, raceEngineer: { name: 'Chiara Rinaldi', style: 'analítico', flag: '🇮🇹' } },
  rodin: { principal: { name: 'Denis Sanaeff', style: 'político', flag: '🇬🇧' }, chiefMechanic: { name: 'Luca Fabbri', style: 'cercano', flag: '🇮🇹' }, raceEngineer: { name: 'Mika Halonen', style: 'analítico', flag: '🇫🇮' } },
  art: { principal: { name: 'Frédéric Sausset', style: 'exigente', flag: '🇫🇷' }, chiefMechanic: { name: 'Pablo Duarte', style: 'práctico', flag: '🇪🇸' }, raceEngineer: { name: 'Clara Noël', style: 'analítico', flag: '🇫🇷' } },
  aix: { principal: { name: 'Gerard Riba', style: 'dinámico', flag: '🇪🇸' }, chiefMechanic: { name: 'Iker Salazar', style: 'práctico', flag: '🇪🇸' }, raceEngineer: { name: 'Mar Costa', style: 'analítico', flag: '🇵🇹' } },
  var: { principal: { name: 'Mathieu van der Berg', style: 'serio', flag: '🇳🇱' }, chiefMechanic: { name: 'Bram de Wit', style: 'práctico', flag: '🇳🇱' }, raceEngineer: { name: 'Sanne Visser', style: 'analítico', flag: '🇳🇱' } },
  trident: { principal: { name: 'Jonny Mackintosh', style: 'cercano', flag: '🇬🇧' }, chiefMechanic: { name: 'Callum Ridge', style: 'práctico', flag: '🇬🇧' }, raceEngineer: { name: 'Oscar Lund', style: 'analítico', flag: '🇸🇪' } },
};

const F2_OWNERS = {
  invicta: { name: 'Raúl Camarero', style: 'exigente', flag: '🇪🇸' },
  hitech: { name: 'Olga Senís', style: 'analítica', flag: '🇪🇸' },
  dams: { name: 'Jacques Lemaire', style: 'pragmático', flag: '🇫🇷' },
  mp: { name: 'Bram van Dam', style: 'cercano', flag: '🇳🇱' },
  prema: { name: 'Grupo PREMA', style: 'resolutivo', flag: '🇮🇹' },
  rodin: { name: 'Racing Steps Foundation', style: 'político', flag: '🇬🇧' },
  art: { name: 'Frédéric Sausset', style: 'exigente', flag: '🇫🇷' },
  aix: { name: 'Jorge Martínez', style: 'dinámico', flag: '🇪🇸' },
  var: { name: 'Van Amersfoort Sport', style: 'serio', flag: '🇳🇱' },
  trident: { name: 'Jonny Mackintosh', style: 'cercano', flag: '🇬🇧' },
};

const F1_BY_ID = new Map(F1_TEAMS.map((t) => [t.id, t]));
const F2_BY_ID = new Map(F2_TEAMS.map((t) => [t.id, t]));

function getTeam(id, series = 'f1') {
  if (series === 'f2') return F2_BY_ID.get(id) || null;
  return F1_BY_ID.get(id) || null;
}

/**
 * Ruta del escudo de la escudería: PNG con fondo transparente en assets/teams.
 * Se deduce del id y la categoría, así que no hay que repetirla en los datos.
 * @param {string|object} team id u objeto de escudería
 * @param {string} series 'f1' | 'f2'
 * @returns {string} ruta relativa; cadena vacía si no hay escudo
 */
function teamLogo(team, series = 'f1') {
  const id = typeof team === 'string' ? team : team?.id;
  if (!id) return '';
  return `assets/teams/${series === 'f2' ? 'f2' : 'f1'}/${id}.png`;
}

function teamsFor(series) {
  return series === 'f2' ? F2_TEAMS : F1_TEAMS;
}

function staffFor(team, series = 'f1') {
  if (series === 'f2') {
    return (
      F2_STAFF[team.id] || {
        principal: { name: 'Dirección del equipo', style: 'cercano', flag: '🇪🇺' },
        chiefMechanic: { name: 'Jefe de mecánicos', style: 'práctico', flag: '🇪🇺' },
        raceEngineer: { name: 'Ingeniero de carrera', style: 'analítico', flag: '🇪🇺' },
      }
    );
  }
  return team.staff;
}

function ownerFor(team, series = 'f1') {
  if (series === 'f1') return { name: `Grupo ${team.name}`, style: 'negociador', flag: team.flag };
  const o = F2_OWNERS[team.id];
  return o ? o : { name: `Accionistas de ${team.name}`, style: 'negociador', flag: team.flag };
}

/** Nivel global del monoplaza 1..100 con el que corre el jugador. */
function carLevel(team, series = 'f1') {
  const c = team.car;
  return Math.round(c.power * 0.3 + c.aero * 0.3 + c.grip * 0.22 + c.brakes * 0.1 + c.reliability * 0.08);
}

/**
 * Multiplicador de rendimiento frente a la referencia.
 * Un Haas o un Cadillac son claramente más lentos que un Ferrari: eso se nota en la pista.
 */
function carPerformance(team, series = 'f1') {
  const level = carLevel(team, series);
  return 0.9 + (level - 82) * 0.0075;
}

const F1_TEAM_TIERS = [
  { tier: 1, label: 'Élite de la parrilla', ids: ['mclaren', 'ferrari', 'mercedes', 'redbull'] },
  { tier: 2, label: 'Aspirantes', ids: ['aston', 'alpine', 'williams'] },
  { tier: 3, label: 'Supervivientes', ids: ['racingbulls', 'haas', 'audi'] },
  { tier: 4, label: 'Novatos', ids: ['cadillac'] },
];

  __x.F1_TEAMS = F1_TEAMS;
  __x.F2_TEAMS = F2_TEAMS;
  __x.F2_STAFF = F2_STAFF;
  __x.F2_OWNERS = F2_OWNERS;
  __x.getTeam = getTeam;
  __x.teamLogo = teamLogo;
  __x.teamsFor = teamsFor;
  __x.staffFor = staffFor;
  __x.ownerFor = ownerFor;
  __x.carLevel = carLevel;
  __x.carPerformance = carPerformance;
  __x.F1_TEAM_TIERS = F1_TEAM_TIERS;
};
__registry["js/game/car.js"] = function (__x, __req) {
// Física de monoplaza vista cenital. Modelo arcade-sim: vector de velocidad,
// agarre lateral con círculo de tracción, DRS, ERS, neumáticos y superficie.
//
// Unidades: metros, segundos, m/s. La pista la aporta track.js (proyección
// sobre la línea central) y aquí solo se resuelve la dinámica del coche.

const { clamp, lerp, sign, mod, TAU } = __req("js/core/util.js");
const { inDrsZone, indexAtS } = __req("js/game/track.js");

/* Neumáticos de seco. La degradación se mide en VUELTAS recorridas: cada
   compuesto tiene una vida útil (`life`) y, al acercarse a ella, pierde
   rendimiento de golpe. De momento no hay gomas de lluvia ni intermedias. */
const TYRES = {
  soft: { id: 'soft', name: 'Blando', code: 'C5', color: '#e8112d', life: 7, pace: 1.034, grip: 1.055, falloff: 0.17, warm: 'alta' },
  medium: { id: 'medium', name: 'Medio', code: 'C3', color: '#f5d000', life: 12, pace: 1, grip: 1, falloff: 0.1, warm: 'media' },
  hard: { id: 'hard', name: 'Duro', code: 'C2', color: '#e6e8ee', life: 16, pace: 0.966, grip: 0.962, falloff: 0.05, warm: 'baja' },
};

const TYRE_ORDER = ['soft', 'medium', 'hard'];

/** Suaviza de 0 a 1 entre dos umbrales. */
function smoothstep(from, to, x) {
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Cuánto ha caido ya el compuesto por el desgaste (0 = nuevo, 1 = en su fin). */
function tyreCliff(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return smoothstep(0.55, 1, clamp(wear, 0, 1)) * t.falloff;
}

/** Factor de velocidad punta que permite el compuesto con ese desgaste. */
function tyrePace(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return t.pace * (1 - tyreCliff(tyreId, wear));
}

/** Factor de agarre lateral con ese desgaste. */
function tyreGrip(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return t.grip * (1 - tyreCliff(tyreId, wear) * 0.7);
}

/** Vueltas de vida que le quedan al compuesto. */
function tyreLapsLeft(tyreId, wear) {
  const t = TYRES[tyreId] || TYRES.medium;
  return Math.max(0, t.life * (1 - clamp(wear, 0, 1)));
}

/**
 * Acumula la distancia rodada y recalcula el desgaste 0..1 del compuesto.
 * @param {object} c estado del coche
 * @param {number} metres metros recorridos en este paso
 * @param {number} lapLength longitud del circuito en metros
 */
function ageTyre(c, metres, lapLength) {
  c.lapDist = (c.lapDist || 0) + metres;
  const life = (TYRES[c.tyre] || TYRES.medium).life * (lapLength || 5000);
  c.tyreWear = clamp(c.lapDist / life, 0, 1.6);
  c.tyreAge = c.lapDist / (lapLength || 5000);
  return c.tyreWear;
}

/** Regulación 2026: gestión de energía con despliegue siempre disponible. */
const PIT_SPEED_KMH = 80;
const ERS_CAPACITY = 100;
const ERS_DEPLOY_RATE = 26;
const ERS_RECHARGE_RATE = 9.5;
const DRS_BOOST = 1.17;

/* ───────────────────── Estado inicial ───────────────────── */

function makeCarState(track, entry, options = {}) {
  const team = entry.team || {};
  const car = team.car || { power: 80, aero: 80, grip: 80, brakes: 80, reliability: 85, budget: 80 };
  return {
    driverId: entry.driverId,
    name: entry.name,
    short: entry.short,
    number: entry.number,
    flag: entry.flag,
    color: team.livery?.primary || '#888',
    teamId: entry.teamId,
    isPlayer: Boolean(entry.isPlayer),

    /* cinemática */
    x: track.start.x,
    y: track.start.y,
    vx: 0,
    vy: 0,
    angle: track.start.heading,
    speed: 0,

    /* posición en pista */
    idx: 0,
    s: 0,
    lap: 0,
    lateral: 0,
    progress: 0,
    position: 1,
    onTrack: true,
    offTrackTime: 0,
    lastOffIdx: -1,
    kerbTime: 0,

    /* Longitudinal */
    gear: 1,
    rpm: 0.2,
    ers: ERS_CAPACITY,
    drsOpen: false,
    drsAvailable: false,
    drsZone: null,

    /* neumáticos */
    tyre: options.tyre || 'medium',
    tyreAge: 0,
    tyreWear: 0,
    tyreTemp: 0.35,
    lapDist: 0,

    /* daños y estado */
    damage: 0,
    retired: false,
    retireReason: null,
    pitStops: 0,
    pitTimer: 0,
    inPit: false,
    lastPitLap: 0,

    /* cronometraje */
    lapMs: 0,
    lastLapMs: 0,
    bestLapMs: 0,
    lapStartMs: 0,
    sectorMs: [0, 0, 0],
    sectorStart: 0,
    positionAtStart: options.grid || 1,
    gaps: { ahead: 0, behind: 0 },
    intervalMs: 0,

    /* entrants */
    skill: entry.skill || 75,
    ratings: entry.ratings || {},
    car,
    started: false,
    reactionMs: 0,
    push: 0,
  };
}

/* ───────────────────── Parámetros derivados ───────────────────── */

function powerFactor(car) {
  /* 78 => 0.93 · 96 => 1.07 */
  return 0.93 + (car.power - 78) * 0.0095;
}

function gripFactor(car) {
  return 0.86 + (car.grip - 78) * 0.012;
}

function brakeFactor(car) {
  return 0.88 + (car.brakes - 78) * 0.011;
}

function aeroFactor(car) {
  return 0.9 + (car.aero - 78) * 0.0105;
}

function maxSpeed(car, drs = false) {
  /* 78 => 68 m/s (245 km/h) · 96 => 83 m/s (300 km/h) */
  const base = 68 + (car.power - 78) * 0.9;
  return base * (drs ? DRS_BOOST : 1);
}

/* ───────────────────── Superficie ───────────────────── */

/**
 * Factor de agarre y resistencia extra en un punto de la pista.
 * @param {object} proj resultado de projectCar
 * @param {object} weather {wet:boolean, rain:number}
 */
function surfaceAt(proj, weather = {}) {
  let grip = 1;
  let drag = 0;
  if (!proj.onTrack) {
    const over = proj.dist - proj.halfWidth;
    grip = over > 6 ? 0.56 : 0.78;
    drag = 2.4;
  } else if (proj.kerb) {
    grip = 0.9;
    drag = 0.5;
  }
  if (weather.wet) {
    grip *= proj.onTrack ? 0.93 : 0.85;
    drag += proj.onTrack ? 0.35 : 1.6;
  }
  return { grip, drag };
}

/* ───────────────────── Integración del jugador ───────────────────── */

/**
 * Integra el coche del jugador un paso de tiempo.
 * @param {object} c estado del coche (mutado)
 * @param {object} input {steer, throttle, brake, drsPressed}
 * @param {object} track circuito construido
 * @param {object} proj proyección sobre la pista
 * @param {object} env {weather, assists, dt}
 */
function stepCar(c, input, track, proj, env = {}) {
  const dt = env.dt || 1 / 60;
  if (c.retired) return;
  const assists = env.assists || {};
  const weather = env.weather || {};
  const surf = surfaceAt(proj, weather);

  const v = Math.max(0, c.speed);
  const power = powerFactor(c.car) * (0.94 + (c.car.aero - 78) * 0.0012);
  const pace = tyrePace(c.tyre, c.tyreWear);
  const topSpeed = maxSpeed(c.car, c.drsOpen) * (weather.wet ? 0.94 : 1) * pace;

  /* ── Empuje longitudinal ── */
  let accel = 0;
  const throttle = clamp(input.throttle || 0, 0, 1);
  const brake = clamp(input.brake || 0, 0, 1);
  const useErs = c.ers > 1 && throttle > 0.2;
  const ersBoost = useErs ? 1 + Math.min(0.34, c.ers / ERS_CAPACITY) * 0.34 : 1;
  const speedFactor = clamp(1 - (v / topSpeed) * 0.92, 0, 1);
  accel += throttle * 13.6 * power * ersBoost * speedFactor;
  accel -= brake * brakeFactor(c.car) * 21 * clamp(v / 12, 0, 1);
  accel -= v * v * 0.0032;
  accel -= v * 0.06;
  accel -= surf.drag * (throttle > 0.1 ? 0.3 : 1);
  if (c.inPit) accel -= 6 + v * 0.9;
  c.push *= Math.exp(-4 * dt);

  const newSpeed = Math.max(0, v + (accel + c.push) * dt);
  c.speed = newSpeed;

  /* ── Dirección ── */
  const steer = clamp(input.steer || 0, -1, 1);
  const speedNorm = clamp(v / 92, 0, 1);
  /* Menos ángulo de/volante a alta velocidad */
  const maxYaw = lerp(2.5, 0.5, speedNorm * speedNorm);
  const assist = assists.steeringAssist ?? 0.4;
  const yawRate = steer * maxYaw * (1 - assist * 0.25);
  c.angle = mod(c.angle + yawRate * dt, TAU);

  /* ── Deslizamiento lateral y círculo de tracción ── */
  const fx = Math.cos(c.angle);
  const fy = Math.sin(c.angle);
  const rx = -fy;
  const ry = fx;
  let vLong = c.vx * fx + c.vy * fy;
  let vLat = c.vx * rx + c.vy * ry;

  const grip = gripFactor(c.car) * tyreGrip(c.tyre, c.tyreWear) * surf.grip * (c.damage > 0.4 ? 0.92 : 1);
  const latBudget = 34 * grip * dt;
  const longUse = clamp(Math.abs(throttle - brake) * 0.7 + brake * 0.4, 0, 1);
  const latCap = latBudget * (1 - longUse * 0.32);
  if (Math.abs(vLat) <= latCap) vLat *= 0.55;
  else vLat -= sign(vLat) * latCap;

  vLong = newSpeed;
  c.vx = fx * vLong + rx * vLat;
  c.vy = fy * vLong + ry * vLat;
  c.x += c.vx * dt;
  c.y += c.vy * dt;

  /* ── Estado de la mecánica ── */
  const gearCount = 8;
  const gear = clamp(Math.ceil((newSpeed / topSpeed) * gearCount), 1, gearCount);
  c.gear = gear;
  c.rpm = clamp(0.18 + (newSpeed / topSpeed) * 0.82, 0, 1);
  c.tyreTemp = clamp(lerp(c.tyreTemp, 0.4 + longUse * 0.6, dt * 0.6), 0, 1);
  ageTyre(c, newSpeed * dt, track.length);

  /* ── ERS ── */
  if (useErs) c.ers = clamp(c.ers - ERS_DEPLOY_RATE * dt, 0, ERS_CAPACITY);
  else c.ers = clamp(c.ers + ERS_RECHARGE_RATE * dt * (0.35 + (throttle > 0.85 ? 0.9 : 0.3)), 0, ERS_CAPACITY);

  /* ── DRS ── */
  c.drsZone = inDrsZone(track, proj.idx);
  c.drsAvailable = Boolean(c.drsZone);
  c.drsOpen = Boolean(c.drsAvailable && (env.autoDrs || (input.drsPressed && v > 22)));

  /* ── Desgaste y fiabilidad ── */
  if (surf.grip < 0.85) {
    c.offTrackTime += dt;
    c.tyreWear = clamp(c.tyreWear + dt * 0.012, 0, 1.6);
    if (c.offTrackTime > 0.9) c.damage = clamp(c.damage + dt * 0.07, 0, 1);
  } else {
    c.offTrackTime = Math.max(0, c.offTrackTime - dt * 2);
  }
  if (proj.kerb) c.kerbTime += dt;
  else c.kerbTime = Math.max(0, c.kerbTime - dt * 3);
}

/* ───────────────────── IA sobre la trazada ───────────────────── */

/**
 * Integra un coche de IA con un modelo ligero: avanza sobre el arco de la pista
 * con una velocidad objetivo, corrige su línea y repite errores humanos.
 * @param {object} c estado del coche
 * @param {object} ctx {dt, track, line, speedRef, skill, rng, weather, tyre, avoiding}
 */
function stepAi(c, ctx) {
  const { dt, track, weather = {} } = ctx;
  if (c.retired) return;
  const m = track.points;
  const surfaceGrip = (weather.wet ? 0.93 : 1) * (c.onTrack ? 1 : 0.72);
  const grip = gripFactor(c.car) * tyreGrip(c.tyre, c.tyreWear) * surfaceGrip;
  const pace = tyrePace(c.tyre, c.tyreWear);

  /* Velocidad objetivo en función de la curva que viene */
  const ahead = 26;
  const i1 = c.idx;
  const i2 = (c.idx + Math.round(ahead / 4.2)) % m.length;
  const k = Math.max(1e-5, Math.abs(m[i2].curv));
  const latAccel = 17.6 * grip * (0.86 + c.skill / 480);
  const vCurve = clamp(Math.sqrt(latAccel / k), 12, maxSpeed(c.car, false) * pace);
  const vTop = maxSpeed(c.car, c.drsOpen) * 0.985 * pace;

  /* Frenada por la distancia a la próxima frenada */
  let target = Math.min(vTop, vCurve);
  const brakingLook = Math.round((vTop * vTop) / (2 * 26 * grip) / 4.2);
  for (let d = 1; d <= brakingLook; d++) {
    const p = m[(c.idx + d) % m.length];
    const kk = Math.max(1e-5, Math.abs(p.curv));
    const vc = clamp(Math.sqrt(latAccel / kk), 12, vTop);
    const dist = d * 4.2;
    const allowed = Math.sqrt(vc * vc + 2 * 26 * grip * dist);
    if (allowed < target) target = allowed;
  }
  /* Si va limpio, no frena de más */
  target = Math.min(target, vTop);
  if (c.avoiding) target *= 0.965;
  /* Coche de seguridad: ritmo de fila india */
  if (ctx.scActive) target = Math.min(target, c.scTarget || 24);

  const accel = target > c.speed ? 12.5 * (c.car.power / 90) : -30 * grip;  c.speed = Math.max(6, c.speed + accel * dt);

  /* Línea objetivo: trazada + anticipación de la frenada + evitación */
  const li = ctx.line[i1] || m[i1];
  const desired = li.offset;
  const brakeShift = clamp((vCurve - c.speed) * 0.6, -3.2, 3.2);
  let targetLateral = desired + brakeShift;
  const limit = Math.max(1.2, m[i1].halfWidth - 1.6);
  if (ctx.avoidLateral) targetLateral += ctx.avoidLateral;
  if (ctx.defendLateral) targetLateral += ctx.defendLateral;
  /* Si se va de pista, vuelve a la trazada antes de perder más tiempo */
  if (Math.abs(c.lateral) > m[i1].halfWidth) targetLateral = lerp(targetLateral, desired, 0.6);
  targetLateral = clamp(targetLateral, -limit, limit);
  c.lateral = lerp(c.lateral, targetLateral, Math.min(1, dt * 3.2));

  /* Deslizamiento y error humano */
  c.slip = (c.slip || 0) * 0.9 + c.rng.gauss(0.6) * dt;
  const wobble = clamp(c.slip, -2.4, 2.4);
  const p = m[i1];
  const lat = c.lateral + wobble;
  const nx = p.nx;
  const ny = p.ny;
  const fx = p.dirX;
  const fy = p.dirY;
  c.x = p.x + nx * lat;
  c.y = p.y + ny * lat;
  c.vx = fx * c.speed;
  c.vy = fy * c.speed;
  c.angle = Math.atan2(fy, fx);
  c.onTrack = Math.abs(lat) <= p.halfWidth + 0.4;
  /* El arco recorrido es la fuente de verdad: si se derivase del punto más
     cercano, el progreso sub-punto se perdería y el coche se quedaría parado */
  c.s = mod((Number.isFinite(c.s) ? c.s : p.s) + c.speed * dt, track.length);
  c.idx = indexAtS(track, c.s);
  c.kerb = Math.abs(lat) > p.halfWidth - 0.9 && Math.abs(lat) < p.halfWidth + 1.4;
  if (!c.onTrack) {
    c.offTrackTime += dt;
    c.tyreWear = clamp(c.tyreWear + dt * 0.006, 0, 1.6);
  } else {
    c.offTrackTime = Math.max(0, c.offTrackTime - dt * 2);
  }

  /* Marcha, ERS, neumáticos */
  c.gear = clamp(Math.ceil((c.speed / (maxSpeed(c.car, false) * pace)) * 8), 1, 8);
  c.rpm = clamp(0.18 + (c.speed / vTop) * 0.82, 0, 1);
  const useErs = c.ers > 2 && c.speed < vTop * 0.9;
  c.ers = clamp(c.ers + (useErs ? -ERS_DEPLOY_RATE : ERS_RECHARGE_RATE) * dt, 0, ERS_CAPACITY);
  ageTyre(c, c.speed * dt, track.length);
  c.tyreTemp = clamp(lerp(c.tyreTemp, 0.75, dt * 0.5), 0, 1);
  c.drsZone = !ctx.scActive && inDrsZone(track, c.idx);
  c.drsAvailable = Boolean(c.drsZone);
  c.drsOpen = Boolean(c.drsZone && c.drsAllowed);
}

/* ───────────────────── Arranque ───────────────────── */

function applyLaunch(c, track, quality = 0.5, rng = null) {
  /* Comienzo de carrera: la velocidad inicial depende de la reacción */
  const base = 26 + quality * 16;
  c.speed = clamp(base + (rng ? rng.gauss(1.4) : 0), 8, 52);
  c.vx = Math.cos(track.start.heading) * c.speed;
  c.vy = Math.sin(track.start.heading) * c.speed;
  c.started = true;
}

/* ───────────────────── Pit stop ───────────────────── */

function pitStopMs(state) {
  if (!state) return 0;
  return state.series === 'f2' ? 0 : 4200;
}

const PIT_BASE_MS = 2400;
const TYRE_CHANGE_MS = 2100;

  __x.TYRES = TYRES;
  __x.TYRE_ORDER = TYRE_ORDER;
  __x.tyreCliff = tyreCliff;
  __x.tyrePace = tyrePace;
  __x.tyreGrip = tyreGrip;
  __x.tyreLapsLeft = tyreLapsLeft;
  __x.ageTyre = ageTyre;
  __x.PIT_SPEED_KMH = PIT_SPEED_KMH;
  __x.ERS_CAPACITY = ERS_CAPACITY;
  __x.ERS_DEPLOY_RATE = ERS_DEPLOY_RATE;
  __x.ERS_RECHARGE_RATE = ERS_RECHARGE_RATE;
  __x.DRS_BOOST = DRS_BOOST;
  __x.makeCarState = makeCarState;
  __x.powerFactor = powerFactor;
  __x.gripFactor = gripFactor;
  __x.brakeFactor = brakeFactor;
  __x.aeroFactor = aeroFactor;
  __x.maxSpeed = maxSpeed;
  __x.surfaceAt = surfaceAt;
  __x.stepCar = stepCar;
  __x.stepAi = stepAi;
  __x.applyLaunch = applyLaunch;
  __x.pitStopMs = pitStopMs;
  __x.PIT_BASE_MS = PIT_BASE_MS;
  __x.TYRE_CHANGE_MS = TYRE_CHANGE_MS;
};
__registry["js/game/career.js"] = function (__x, __req) {
// Estado de la carrera: perfil del jugador, equipo, calendario, historial,
// buzón, noticias y objetivos. Es el objeto que se guarda en localStorage.

const { makeRng, randomSeed } = __req("js/core/rng.js");
const { SEASON, roundsFor, getRound, TESTING, roundIsComplete, nextPendingSession } = __req("js/data/calendar.js");
const { getTeam, teamsFor, carLevel, carPerformance, staffFor, ownerFor } = __req("js/data/teams.js");
const { F1_DRIVERS, F2_DRIVERS, findDriver, averageRating, driverNationality } = __req("js/data/drivers.js");
const { countryByCode, ageAt, validateBirth, MIN_AGE, MAX_AGE } = __req("js/data/countries.js");
const { buildInbox } = __req("js/game/mail.js");
const { buildNews } = __req("js/game/news.js");
const { buildStandings, playerRow, teamRow, pointsForPosition, scoreSession } = __req("js/game/standings.js");
const { deepClone, clamp, fmtLap } = __req("js/core/util.js");

const CAREER_VERSION = 3;
const START_SERIES = 'f2';

/* ───────────────────── Perfil del jugador ───────────────────── */

/** Dorsales disponibles: los de F1/F2 más los reservados para el jugador. */
const PLAYER_NUMBERS = [7, 11, 14, 18, 19, 21, 23, 27, 31, 44, 55, 63, 77, 81, 87, 88, 99];

function pickNumber(series, rng, replacedId) {
  const used = new Set(
    (series === 'f2' ? F2_DRIVERS : F1_DRIVERS).filter((d) => d.id !== replacedId).map((d) => d.number)
  );
  const free = PLAYER_NUMBERS.filter((n) => !used.has(n));
  return free.length ? rng.pick(free) : 99;
}

/** Crea el piloto jugador a partir del formulario de la pantalla de creación. */
function makeDriver(profile, series, replacedDriver, team) {
  const rng = makeRng(`${profile.name}|${profile.birthDate}|${profile.country}|${series}`);
  const age = ageAt(profile.birthDate, '2026-03-05');
  const country = countryByCode(profile.country);
  /* Código de tres letras al estilo de la FIA: una por nombre y, si no llega,
     se completa con la letra siguiente de cada palabra */
  const words = profile.name.split(/\s+/).filter(Boolean);
  let short = words.map((w) => w[0]).join('');
  for (const w of words) {
    if (short.length >= 3) break;
    for (let i = 1; i < w.length && short.length < 3; i++) short += w[i];
  }
  short = short.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase();
  const base = replacedDriver ? averageRating(replacedDriver.ratings) : 72;
  /* Los puntos de partida suben con la edad, como en la vida real */
  const ageBonus = clamp((age - MIN_AGE) * 0.55, 0, 14);
  const skill = clamp(Math.round(base * 0.62 + ageBonus + rng.gauss(2)), 58, 88);
  const qualiBonus = rng.int(-4, 5);
  return {
    id: 'player',
    name: profile.name.trim(),
    short,
    code: short,
    number: pickNumber(series, rng, replacedDriver?.id),
    country: profile.country,
    flag: country.flag,
    nationality: country.demonym,
    age,
    birthDate: profile.birthDate,
    helmet: { primary: profile.helmetPrimary, secondary: profile.helmetSecondary, style: profile.helmetStyle },
    isPlayer: true,
    replacedId: replacedDriver ? replacedDriver.id : null,
    traits: buildTraits(rng, age),
    ratings: {
      pace: clamp(skill + rng.int(-3, 3), 50, 92),
      braking: clamp(skill + rng.int(-4, 2), 50, 92),
      control: clamp(skill + rng.int(-3, 4), 50, 92),
      consistency: clamp(skill + rng.int(-2, 5), 50, 92),
      racecraft: clamp(skill + rng.int(-5, 3), 50, 92),
      quali: clamp(skill + qualiBonus, 50, 94),
      tyre: clamp(skill + rng.int(-4, 3), 50, 92),
      starts: clamp(skill + rng.int(-6, 3), 50, 92),
      wet: clamp(skill + rng.int(-6, 4), 50, 92),
    },
    potential: clamp(skill + rng.int(8, 20), 70, 97),
    form: 0,
    fatigue: 0,
    morale: 70,
    teamId: team.id,
  };
}

function buildTraits(rng, age) {
  const pool = [
    'Arranque rápido',
    'Frenada tardía',
    'Gestión de neumáticos',
    'Muy fuerte con lluvia',
    'Recupera posiciones',
    'Polivalente',
    'Valiente en los adelantamientos',
    'Frío en la pole',
    'Se complica en el tráfico',
    'Especialista en circuitos',
  ];
  const traits = [];
  const a = rng.pick(pool);
  const b = rng.pick(pool.filter((t) => t !== a));
  traits.push(a, b);
  if (age >= 40) traits.push('Experiencia en boxes');
  if (age <= 19) traits.push('Joven y sin miedo');
  return traits;
}

/* ───────────────────── Creación de carrera ───────────────────── */

/**
 * Fichaje: elige equipo aleatorio de F2 y, opcionalmente, piloto a sustituir.
 * @param {object} profile {name, birthDate, country, helmetPrimary, helmetSecondary, helmetStyle}
 * @param {object} options {series, replaceDriverId, teamId, seed}
 */
function createCareer(profile, options = {}) {
  const validation = validateBirth(profile.birthDate);
  if (!validation.ok) throw new Error(validation.error);
  if (!profile.name || !profile.name.trim()) throw new Error('Falta el nombre del piloto.');
  const country = countryByCode(profile.country);
  if (!country || country.code === 'INT') throw new Error('País no válido.');

  const series = options.series || START_SERIES;
  const seed = options.seed || randomSeed();
  const rng = makeRng(`${seed}|career`);
  const pool = teamsFor(series);
  /* Un equipo por azar ponderado: los grandes atraen más a los managers */
  const team = options.teamId ? getTeam(options.teamId, series) : rng.weighted(pool, (t) => 40 + t.car.budget * 1.6);

  const roster = (series === 'f2' ? F2_DRIVERS : F1_DRIVERS).filter((d) => d.teamId === team.id);
  let replaced = null;
  if (options.replaceDriverId) {
    replaced = findDriver(options.replaceDriverId, series);
    if (replaced && replaced.teamId !== team.id) replaced = null;
  }
  if (!replaced) {
    /* Si no se elige piloto, el jugador occupies un asiento libre del equipo */
    const free = pool.filter((t) => t.id !== team.id);
    if (free.length && rng.chance(0.12)) {
      return createCareer(profile, { ...options, series, seed: seed + 1, teamId: rng.pick(free).id, replaceDriverId: null });
    }
    replaced = roster.length ? rng.pick(roster) : null;
  }

  const driver = makeDriver(profile, series, replaced, team);
  const entryList = buildEntryList(series, driver);

  const state = {
    version: CAREER_VERSION,
    seed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    season: SEASON,
    series,
    round: 1,
    phase: 'paddock',
    driver,
    team,
    teamId: team.id,
    entryList,
    removedDriver: replaced ? { id: replaced.id, name: replaced.name, teamId: replaced.teamId, number: replaced.number } : null,
    history: [],
    inbox: [],
    news: [],
    unreadMail: 0,
    unreadNews: 0,
    careerStats: { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0 },
    objectives: buildObjectives(series, driver),
    pending: null,
    meta: {
      driverName: driver.name,
      driverFlag: driver.flag,
      teamName: team.name,
      teamColor: team.livery.primary,
      series,
      round: 1,
      roundLabel: '',
    },
  };

  refreshDerived(state);
  const round = getRound(state.series, state.round);
  state.inbox = unreadInbox(state, buildInbox(state, round, null));
  state.news = unreadNews(state, buildNews(state, round, null));
  return state;
}

/** Plantilla de objetivos que se muestra en el menú del piloto. */
function buildObjectives(series, driver) {
  if (series === 'f2') {
    return [
      { id: 'o1', text: 'Termina entre los tres primeros del campeonato de F2', kind: 'championship', target: 3, done: false },
      { id: 'o2', text: 'Consigue tu primera pole', kind: 'pole', target: 1, done: false },
      { id: 'o3', text: 'Sube a un equipo de Fórmula 1', kind: 'promotion', target: 1, done: false },
    ];
  }
  return [
    { id: 'o1', text: 'Termina entre los tres primeros del campeonato', kind: 'championship', target: 3, done: false },
    { id: 'o2', text: 'Gana un Gran Premio', kind: 'win', target: 1, done: false },
    { id: 'o3', text: 'Consigue tres poles', kind: 'poles', target: 3, done: false },
  ];
}

/**
 * Lista de participantes de una categoría con el jugador sustituido por su homónimo.
 * @returns {Array} entradas {driverId, name, short, flag, number, teamId, team, isPlayer, ratings, skill}
 */
function buildEntryList(series, playerDriver) {
  const list = (series === 'f2' ? F2_DRIVERS : F1_DRIVERS)
    .filter((d) => d.id !== playerDriver.replacedId)
    .map((d) => ({
      driverId: d.id,
      name: d.name,
      short: d.short,
      code: d.code,
      flag: d.flag,
      number: d.number,
      country: d.country,
      teamId: d.teamId,
      team: getTeam(d.teamId, series),
      isPlayer: false,
      ratings: d.ratings,
      skill: averageRating(d.ratings),
      traits: d.traits,
      age: d.age,
    }));
  list.push({
    driverId: 'player',
    name: playerDriver.name,
    short: playerDriver.short,
    code: playerDriver.code,
    flag: playerDriver.flag,
    number: playerDriver.number,
    country: playerDriver.country,
    teamId: playerDriver.teamId,
    team: getTeam(playerDriver.teamId, series),
    isPlayer: true,
    ratings: playerDriver.ratings,
    skill: averageRating(playerDriver.ratings),
    traits: playerDriver.traits,
    age: playerDriver.age,
  });
  return list;
}

/** Rival más cercano en la parrilla para los mensajes privados. */
function rivalsOf(state) {
  return state.entryList
    .filter((e) => !e.isPlayer)
    .sort((a, b) => b.skill - a.skill)
    .slice(0, 5);
}

/* ───────────────────── Datos derivados ───────────────────── */

/** Recalcula standings, meta y contadores a partir del historial. */
function refreshDerived(state) {
  const table = buildStandings(state.series, state.history, metaFor(state));
  state.standings = {
    drivers: table.drivers,
    teams: table.teams,
    self: playerRow(table, 'player'),
    team: teamRow(table, state.teamId),
    roundsDone: table.roundsDone,
    roundsTotal: table.roundsTotal,
  };
  /* Formato compacto para noticias y correo */
  state.standings.rows = table.drivers.map((d) => ({
    name: d.name,
    flag: d.flag,
    points: d.points,
    wins: d.wins,
    isPlayer: d.driverId === 'player',
  }));
  state.driver.points = state.standings.self?.points || 0;
  state.driver.championship = state.standings.self || null;
  state.meta.round = state.round;
  state.meta.series = state.series;
  state.meta.teamName = state.team.name;
  state.meta.teamColor = state.team.livery.primary;
  state.meta.driverName = state.driver.name;
  state.meta.driverFlag = state.driver.flag;
  state.meta.points = state.driver.points;
  state.meta.position = state.standings.self?.position || null;
  state.updatedAt = new Date().toISOString();
  return state;
}

function metaFor(state) {
  const out = {};
  for (const e of state.entryList) {
    out[e.driverId] = { teamId: e.teamId, name: e.name, flag: e.flag, short: e.short, color: e.team?.livery?.primary };
  }
  return out;
}

/* ───────────────────── Consultas de calendario ───────────────────── */

function currentRound(state) {
  const list = roundsFor(state.series);
  /* Con la temporada cerrada se sigue viendo la última ronda */
  return getRound(state.series, state.round) || list[list.length - 1] || null;
}

function calendarFor(state) {
  return roundsFor(state.series);
}

function isSeasonOver(state) {
  return Boolean(state.seasonOver) || state.round > roundsFor(state.series).length;
}

/** Sesión obligatoria pendiente de la ronda actual. */
function pendingSession(state) {
  const round = currentRound(state);
  return nextPendingSession(round);
}

function roundFinished(state) {
  return roundIsComplete(currentRound(state));
}

/** Días hasta el próximo Gran Premio desde una fecha de referencia. */
function daysToRound(state) {
  const round = currentRound(state);
  const today = state.meta.today || '2026-03-01';
  const target = round.days.sun;
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${target}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function testingWeeks(series) {
  return TESTING[series] || [];
}

/* ───────────────────── Avanzar en el calendario ───────────────────── */

/**
 * Salta al siguiente evento tras completar todas las sesiones obligatorias.
 * Genera buzón y noticias de la nueva ronda.
 */
function advanceToNextRound(state) {
  if (!roundFinished(state)) return { ok: false, error: 'Todavía quedan sesiones obligatorias.' };
  const total = roundsFor(state.series).length;
  if (state.round >= total) {
    return finishSeason(state);
  }
  state.round += 1;
  state.phase = 'paddock';
  const round = currentRound(state);
  state.meta.today = round.days.wed;
  state.inbox = unreadInbox(state, buildInbox(state, round, lastSummary(state)));
  state.news = unreadNews(state, buildNews(state, round, lastSummary(state)));
  return { ok: true, round };
}

function lastSummary(state) {
  const prev = state.history[state.history.length - 1];
  if (!prev) return null;
  const main = prev.results.find((r) => r.kind === 'feature');
  if (!main) return null;
  const mine = main.entries.find((e) => e.driverId === 'player');
  const quali = prev.results.find((r) => r.kind === 'quali');
  const myQuali = quali ? quali.entries.find((e) => e.driverId === 'player') : null;
  const scored = scoreSession(main).find((e) => e.driverId === 'player');
  return {
    position: mine ? mine.position : null,
    grid: myQuali ? myQuali.grid : mine ? mine.grid : null,
    pole: Boolean(myQuali && myQuali.position === 1),
    retired: Boolean(mine && mine.dsq),
    bestLapText: mine && mine.bestLapMs ? fmtLap(mine.bestLapMs) : null,
    points: scored ? scored.points : 0,
    corner: mine ? Math.max(1, Math.round(mine.position)) : 6,
  };
}

  /** Fin de temporada: decide si hay ascenso a F1 o título. */
function finishSeason(state) {
  const standings = state.standings;
  const self = standings.self;
  const total = roundsFor(state.series).length;
  const champion = Boolean(self && self.position === 1);
  state.seasonOver = true;
  if (state.series === 'f2') {
    if (champion) {
      state.pending = { kind: 'promotion', text: 'Campeón de Fórmula 2. Hay tres equipos de F1 preguntando por ti.' };
    } else if (self && self.position <= 3) {
      state.pending = { kind: 'promotion', text: `Terminas ${self.position}º en F2. Un equipo de F1 quiere llevarte a la categoría reina.` };
    } else {
      state.pending = { kind: 'f2-stay', text: 'Temporada cerrada sin ascenso. Puedes repetir la temporada con este equipo.' };
    }
  } else {
    state.pending = {
      kind: champion ? 'champion' : 'season-end',
      text: champion ? '¡Campeón del mundo! Temporada cerrada.' : 'Temporada de F1 cerrada.',
    };
  }
  state.meta.roundsTotal = total;
  return { ok: true, seasonOver: true, pending: state.pending };
}

/* ───────────────────── Resultados ───────────────────── */

/** Registra el resultado de una sesión ya resuelta. */
function recordSession(state, sessionResult) {
  const round = currentRound(state);
  const session = round.sessions.find((s) => s.id === sessionResult.sessionId);
  if (session) {
    session.played = true;
    session.result = sessionResult;
  }
  let entry = state.history.find((h) => h.round === round.round);
  if (!entry) {
    entry = { round: round.round, circuitId: round.circuitId, gp: round.gp, date: round.days.sun, results: [] };
    state.history.push(entry);
  }
  entry.results = entry.results.filter((r) => r.sessionId !== sessionResult.sessionId);
  entry.results.push(sessionResult);
  entry.results.sort((a, b) => a.order - b.order);

  const main = sessionResult.kind === 'feature' ? sessionResult : null;
  /* Las estadísticas se recalculan desde el historial: así volver a jugar una
     sesión ya registrada no duplica starts ni puntos */
  recomputeCareerStats(state);
  if (main) {
    const scored = scoreSession(main);
    const me = scored.find((e) => e.driverId === 'player');
    updateObjectives(state, {
      win: Boolean(me && me.position === 1),
      pole: Boolean(me && me.grid === 1),
      pod: Boolean(me && me.position <= 3),
      position: me ? me.position : null,
    });
  }
  refreshDerived(state);
  state.phase = 'paddock';
  return state;
}

/** Deriva las estadísticas de carrera del historial completo. */
function recomputeCareerStats(state) {
  const stats = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0 };
  if (state.careerStats && state.careerStats.f2) stats.f2 = state.careerStats.f2;
  for (const round of state.history) {
    for (const result of round.results) {
      if (result.kind !== 'feature' && result.kind !== 'sprint') continue;
      const me = scoreSession(result).find((e) => e.driverId === 'player');
      if (!me) continue;
      stats.points += me.points;
      if (result.kind !== 'feature') continue;
      stats.starts += 1;
      if (me.position === 1) stats.wins += 1;
      if (me.position <= 3) stats.podiums += 1;
      if (me.grid === 1) stats.poles += 1;
      if (me.dsq || me.position > 10) stats.dnfs += 1;
      if (!stats.bestFinish || me.position < stats.bestFinish) stats.bestFinish = me.position;
    }
  }
  stats.points = Math.round(stats.points * 100) / 100;
  state.careerStats = stats;
  return stats;
}

function updateObjectives(state, { win, pole, pod, position }) {
  const self = state.standings.self;
  for (const o of state.objectives) {
    if (o.kind === 'win' && win) o.done = true;
    if (o.kind === 'pole' && pole) o.done = true;
    if (o.kind === 'podium' && pod) o.done = true;
    /* Objetivos con cantidad: poles, podios, Starts... */
    if (o.kind === 'poles' && pole) {
      o.progress = Math.min(1, ((o.progress || 0) + (o.count || 0) + 1) / o.target);
      o.count = (o.count || 0) + 1;
      o.done = o.count >= o.target;
    }
    if (o.kind === 'podiums' && pod) {
      o.progress = Math.min(1, ((o.progress || 0) + (o.count || 0) + 1) / o.target);
      o.count = (o.count || 0) + 1;
      o.done = o.count >= o.target;
    }
    if (o.kind === 'championship' && self && self.position <= o.target) o.progress = Math.min(1, self.position / o.target);
  }
}

/* ───────────────────── Ascenso a F1 ───────────────────── */

/**
 * Sube al jugador a un equipo de F1. Elige el equipo con mejor hueco
 * y genera el evento de fichaje.
 * @param {string} [f1TeamId] equipo elegido por el jugador
 */
function promoteToF1(state, f1TeamId = null) {
  if (state.series === 'f1') return { ok: false, error: 'Ya estás en Fórmula 1.' };
  const rng = makeRng(`${state.seed}|promotion|${state.round}`);
  const pool = teamsFor('f1');
  const team = f1TeamId ? getTeam(f1TeamId, 'f1') : rng.weighted(pool, (t) => 20 + t.car.budget * 1.2);

  /* El equipo de F1 sustituye a uno de sus pilotos: se elige el peor clasificado */
  const roster = F1_DRIVERS.filter((d) => d.teamId === team.id);
  const replaced = roster.length ? roster[rng.int(0, roster.length - 1)] : null;

  const oldDriver = state.driver;
  oldDriver.ratingBase = Math.round(averageRating(oldDriver.ratings));
  const driver = {
    ...oldDriver,
    number: pickNumber('f1', rng, replaced ? replaced.id : null),
    teamId: team.id,
    isPromoted: true,
  };
  /* Al subir de categoría el techo baja: hay menos margen para el error */
  const cap = 92;
  for (const k of Object.keys(driver.ratings)) {
    driver.ratings[k] = clamp(driver.ratings[k] + 3, 55, cap);
  }
  driver.potential = clamp(oldDriver.potential, 70, 98);

  state.series = 'f1';
  state.round = 1;
  state.team = team;
  state.teamId = team.id;
  state.driver = driver;
  /* El piloto al que sustituye sale de la lista: si no, la parrilla tendría 23 */
  state.entryList = buildEntryList('f1', { ...driver, replacedId: replaced ? replaced.id : null });
  state.removedDriver = replaced ? { id: replaced.id, name: replaced.name, teamId: replaced.teamId, number: replaced.number } : null;
  state.history = [];
  state.careerStats = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0, f2: state.careerStats };
  state.objectives = buildObjectives('f1', driver);
  state.pending = null;
  state.seasonOver = false;
  state.promoted = { at: new Date().toISOString(), from: 'f2', teamId: team.id, teamName: team.name, replaced: replaced?.name || null };
  refreshDerived(state);
  const round = currentRound(state);
  state.meta.today = '2026-03-01';
  state.inbox = unreadInbox(state, buildInbox(state, round, null));
  state.news = unreadNews(state, buildNews(state, round, null));
  return { ok: true, team, replaced };
}

/** Repite la temporada de F2 con el mismo equipo (opción si no hay ascenso). */
function repeatSeason(state) {
  state.round = 1;
  state.history = [];
  state.seasonOver = false;
  state.pending = null;
  /* Al repetir se reinicia la temporada en curso, pero el historial de F2 se
     conserva dentro de las estadísticas de carrera */
  const previous = state.careerStats.f2 || null;
  state.careerStats = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: null, dnfs: 0, ...(previous ? { f2: previous } : {}) };
  state.objectives = buildObjectives(state.series, state.driver);
  refreshDerived(state);
  const round = currentRound(state);
  state.meta.today = '2026-03-01';
  state.inbox = unreadInbox(state, buildInbox(state, round, null));
  state.news = unreadNews(state, buildNews(state, round, null));
  return { ok: true };
}

/* ───────────────────── Buzón y noticias ───────────────────── */

function refreshInbox(state) {
  state.inbox = unreadInbox(state, buildInbox(state, currentRound(state), lastSummary(state)));
  return state.inbox;
}

function refreshNews(state) {
  state.news = unreadNews(state, buildNews(state, currentRound(state), lastSummary(state)));
  return state.news;
}

/** Marca todo el buzón como pendiente de lectura y actualiza el contador. */
function unreadInbox(state, list) {
  for (const m of list) m.unread = true;
  state.unreadMail = list.length;
  return list;
}

/** Igual para las noticias de la pantalla de inicio. */
function unreadNews(state, list) {
  for (const n of list) n.unread = true;
  state.unreadNews = list.length;
  return list;
}

function markMailRead(state, id = null) {
  for (const m of state.inbox) {
    if ((id === null || m.id === id) && m.unread !== false) {
      m.unread = false;
      state.unreadMail = Math.max(0, (state.unreadMail || 0) - 1);
    }
  }
  return state;
}

function markNewsRead(state, id = null) {
  for (const n of state.news) {
    if ((id === null || n.id === id) && n.unread !== false) {
      n.unread = false;
      state.unreadNews = Math.max(0, (state.unreadNews || 0) - 1);
    }
  }
  return state;
}

/* ───────────────────── Datos para las pantallas ───────────────────── */

function driverCard(state) {
  return {
    name: state.driver.name,
    short: state.driver.short,
    number: state.driver.number,
    flag: state.driver.flag,
    country: countryByCode(state.driver.country).name,
    nationality: driverNationality(state.driver),
    age: state.driver.age,
    birthDate: state.driver.birthDate,
    helmet: state.driver.helmet,
    traits: state.driver.traits,
    ratings: state.driver.ratings,
    ovr: averageRating(state.driver.ratings),
    potential: state.driver.potential,
    team: state.team,
    series: state.series,
    points: state.driver.points,
    championship: state.standings.self,
  };
}

/**
 * Lista de entrada para la parrilla con el coche actual del jugador.
 * Las entradas guardan una copia del equipo en el momento de crearse, así que
 * sin esto el monoplaza que sale a pista podría no ser el de su escudería.
 * @param {object} state estado de carrera
 * @returns {Array<object>}
 */
function gridEntryList(state) {
  const list = state?.entryList;
  if (!Array.isArray(list)) return [];
  const team = state.team;
  if (!team) return list.slice();
  return list.map((entry) => (entry.teamId === state.teamId ? { ...entry, team } : entry));
}

/**
 * Limpia una partida guardada por una versión anterior.
 * El garaje ya no desarrolla el monoplaza, así que se restaura el coche de
 * fábrica y se borran los campos del antiguo sistema de mejora.
 * @param {object} state estado de carrera
 * @returns {object} el mismo estado, ya saneado
 */
function hydrateState(state) {
  if (!state || typeof state !== 'object') return state;
  if (state.teamDevelopment === undefined && !state.teamUpgraded) return state;
  const base = getTeam(state.teamId, state.series);
  if (base && state.team) state.team = { ...state.team, car: { ...base.car } };
  delete state.teamDevelopment;
  delete state.teamUpgraded;
  return state;
}

function teamCard(state) {
  const staff = staffFor(state.team, state.series);
  return {
    team: state.team,
    series: state.series,
    level: carLevel(state.team, state.series),
    performance: carPerformance(state.team, state.series),
    owner: ownerFor(state.team, state.series),
    principal: staff.principal,
    raceEngineer: staff.raceEngineer,
    chiefMechanic: staff.chiefMechanic,
    championship: state.standings.team,
  };
}

function carStats(state) {
  const c = state.team.car;
  return [
    { key: 'Potencia', value: c.power },
    { key: 'Aerodinámica', value: c.aero },
    { key: 'Agarre', value: c.grip },
    { key: 'Frenos', value: c.brakes },
    { key: 'Fiabilidad', value: c.reliability },
    { key: 'Presupuesto', value: c.budget },
  ];
}



  __x.pointsForPosition = pointsForPosition;
  __x.deepClone = deepClone;
  __x.CAREER_VERSION = CAREER_VERSION;
  __x.START_SERIES = START_SERIES;
  __x.makeDriver = makeDriver;
  __x.createCareer = createCareer;
  __x.buildEntryList = buildEntryList;
  __x.rivalsOf = rivalsOf;
  __x.refreshDerived = refreshDerived;
  __x.currentRound = currentRound;
  __x.calendarFor = calendarFor;
  __x.isSeasonOver = isSeasonOver;
  __x.pendingSession = pendingSession;
  __x.roundFinished = roundFinished;
  __x.daysToRound = daysToRound;
  __x.testingWeeks = testingWeeks;
  __x.advanceToNextRound = advanceToNextRound;
  __x.recordSession = recordSession;
  __x.promoteToF1 = promoteToF1;
  __x.repeatSeason = repeatSeason;
  __x.refreshInbox = refreshInbox;
  __x.refreshNews = refreshNews;
  __x.markMailRead = markMailRead;
  __x.markNewsRead = markNewsRead;
  __x.driverCard = driverCard;
  __x.gridEntryList = gridEntryList;
  __x.hydrateState = hydrateState;
  __x.teamCard = teamCard;
  __x.carStats = carStats;
};
__registry["js/game/mail.js"] = function (__x, __req) {
// Buzón del piloto: mensajes del jefe de equipo, ingenieros, rivales, propietarios y prensa.
// Todo se genera con RNG sembrado por carrera + ronda, de modo que un buzón es
// estable entre recargas pero distinto en cada partida.

const { makeRng } = __req("js/core/rng.js");
const { staffFor, ownerFor } = __req("js/data/teams.js");
const { pos } = __req("js/core/util.js");

let counter = 0;

const ROLE = {
  principal: { label: 'Jefe de equipo', tag: 'jefe' },
  raceEngineer: { label: 'Ingeniero de carrera', tag: 'ingeniero' },
  chiefMechanic: { label: 'Jefe de mecánicos', tag: 'mecanico' },
  owner: { label: 'Propietario', tag: 'propietario' },
  press: { label: 'Prensa', tag: 'prensa' },
  rival: { label: 'Rival', tag: 'rival' },
  fia: { label: 'Comisarios', tag: 'fia' },
};

function roleLabel(role) {
  return ROLE[role]?.label || 'Contacto';
}

function roleTag(role) {
  return ROLE[role]?.tag || 'otro';
}

function makeMessage({ from, role, subject, body, kind, date, weight = 1 }) {
  counter += 1;
  return { id: `m${counter}-${kind}-${role}`, from, role, subject, body, kind, date, unread: true, weight };
}

/* ───────────────────── Plantillas de texto ───────────────────── */

function principalBody(ctx) {
  const { driver, team, standings, lastResult, rng, round, series, principal } = ctx;
  const owner = ownerFor(team, series);
  const surname = driver.name.split(' ').slice(-1)[0];
  const lines = [];

  if (!lastResult) {
    lines.push(
      `Bienvenido a ${team.name}, ${surname}. Soy ${principal} y desde hoy este equipo es también tu casa.`,
      `No te voy a vender una película: el objetivo es el campeonato. Pero ${owner.name} ha apostado por ti y eso es una carrera entera.`
    );
  } else if (lastResult.position === 1) {
    lines.push(
      `Todavía no me lo creo. Victoria en ${round.circuit.name} y el paddock hablando de ti.`,
      'Esto es justo lo que firmamos. Ahora viene lo difícil: repetirlo sin que nadie te toque.'
    );
  } else if (lastResult.position >= 2 && lastResult.position <= 3) {
    lines.push(`Podio en ${round.gp}. Buen trabajo. Esta noche no se toca el coche: nos quedamos con esta configuración.`);
  } else if (lastResult.retired) {
    lines.push('Vamos a ser sinceros: abandonamos. No pasa nada, pero este rendimiento no nos vale. Repasamos datos en el debrief.');
  } else {
    lines.push(
      `${pos(lastResult.position)}. Hay puntos en la bolsa, pero el ritmo no era el nuestro.`,
      'La próxima vez, la primera vuelta con el depósito más ligero.'
    );
  }

  if (lastResult && lastResult.grid <= 3 && lastResult.position > lastResult.grid) {
    lines.push('Y la salida nos costó puntos. El criterio está claro: nada de saltar a la primera curva.');
  }
  if (standings && standings.position <= 3) {
    lines.push(`Vas ${pos(standings.position)} del campeonato. Así se sube.`);
  }
  lines.push(rng.pick(['Confío en ti.', 'Este es el bloque que nos define. A por él.', 'El lunes revisamos datos.']));
  return lines.join('\n\n');
}

function engineerBody(ctx) {
  const { driver, lastResult, rng, round, corner, weather } = ctx;
  const first = driver.name.split(' ')[0];
  const lines = [];
  if (!lastResult) {
    lines.push(
      `${first}, bienvenido. Soy tu ingeniero. En los libres te voy leyendo datos; en carrera solo te diré una palabra: box.`,
      `La base para ${round.circuit.name}: alerones un punto más blandos en ${round.circuit.corners[0] || 'la primera curva'} y Diff alto para la salida de ${round.circuit.corners[2] || 'curva lenta'}.`
    );
  } else if (lastResult.retired) {
    lines.push(
      `Vimos el toque en la curva ${corner}. ${rng.pick(['Hubo presión de más por delante.', 'El neumático ya estaba fuera de ventana.', 'Entramos demasiado caliente.'])}`,
      'Mañana bajamos el Diff dos puntos y te damos más margen en la frenada.'
    );
  } else {
    lines.push(
      `Tu mejor vuelta (${lastResult.bestLapText || 'sin referencia'}) confirma que el coche está donde tiene que estar.`,
      weather === 'wet'
        ? 'Con pista mojada ese milisegundo vale por diez. Nada de heroísmos en la primera vuelta.'
        : 'Seco y limpio. Nos falta ritmo en la recta larga, probaremos el ala trasera más baja.'
    );
  }
  lines.push(rng.pick(['¿Alguna duda antes de salir?', 'Sin preguntas entonces. Nos vemos en pista.', 'Avísame si el asiento te molesta.']));
  return lines.join('\n\n');
}

function mechanicBody(ctx) {
  const { driver, rng, team } = ctx;
  const pitLap = rng.int(12, 28);
  return (
    `Segunda persona: ${driver.name}. Hoy sales con ${rng.pick(['blandos nuevos', 'medios usados', 'duros de repuesto'])} ` +
    `y el pit stop previsto en la vuelta ${pitLap}.\n\n` +
    `Confianza al ${100 - Math.round(team.car.reliability * 0.25)} %. No me hagas gastarte los neumáticos antes de tiempo, ¿entendido?`
  );
}

function pressBody(ctx) {
  const { driver, standings, rng, lastResult, team, round, series } = ctx;
  const title = series === 'f1' ? 'Fórmula 1' : 'Fórmula 2';
  if (standings && standings.position === 1) {
    return (
      `"${driver.name} lidera el campeonato y nadie lo discute." En ${title} el paddock ya habla de ` +
      `${round.circuit.name} y de si este nivel se sostiene hasta noviembre. ${team.name} ha encontrado un piloto que da miedo.`
    );
  }
  if (lastResult && lastResult.position === 1) {
    return `Victoria de ${driver.name} en ${round.gp}. La prensa no habla de otra cosa: es el nombre de la semana.`;
  }
  if (lastResult && lastResult.retired) {
    return `Abandono de ${driver.name} en ${round.circuit.name}. La escudería descarta un problema mecánico: "Fue un error nuestro".`;
  }
  return (
    `"${driver.name} sigue ${pos(standings ? standings.position : 1)} del campeonato." El paddock ya ` +
    `${rng.pick(['especula', 'cuenta los puntos', 'calcula', 'apuesta'])} por su ` +
    `${rng.pick(['contrato', 'promoción', 'próximo test', 'siguiente carrera'])}.`
  );
}

function rivalBody(ctx) {
  const { lastResult, rng, rivals, round } = ctx;
  if (!rivals || !rivals.length) return `Buena suerte en ${round.circuit.name}. Nos vemos en la pista.`;
  const rival = rng.pick(rivals);
  let body;
  if (lastResult && lastResult.position === 1) {
    body = `Enhorabuena en ${round.gp}. Nos lo trabajaremos en ${round.circuit.name}.`;
  } else if (lastResult && lastResult.position && lastResult.position <= 6) {
    body = `Buen ritmo. En ${round.circuit.name} quiero probar el coche en la zona de ${rng.pick(['frenada', 'trazada rota', 'curva lenta', 'recta de meta'])}.`;
  } else {
    body = `¿Has visto lo de ${round.circuit.name}? Es ${rng.pick(['engañoso', 'técnico', 'divertido', 'físico'])}. Cuidado en ${round.circuit.corners[3] || 'la última curva'}.`;
  }
  return `${rival.name}\n\n${body}`;
}

function fiaBody(ctx) {
  const { rng, driver, round } = ctx;
  return (
    `Investigación cerrada sobre ${driver.name} (${round.gp}): ` +
    rng.pick([
      'sin sanciones.',
      'se archiva sin cargos.',
      'no se encuentra ninguna infracción.',
      'se confirma que el límite de pista se cruzó sin intención.',
    ])
  );
}

function templateFor(role) {
  switch (role) {
    case 'principal':
      return principalBody;
    case 'raceEngineer':
      return engineerBody;
    case 'chiefMechanic':
      return mechanicBody;
    case 'press':
      return pressBody;
    case 'rival':
      return rivalBody;
    default:
      return fiaBody;
  }
}

const PRESS_OUTLETS = ['Autosprint', 'F1 Magazine', 'El Mundo Motor', 'La Gaceta del paddock', 'SportFeed', 'Mundialsport'];

/**
 * Genera el buzón completo de una ronda.
 * @param {object} state estado de carrera
 * @param {object} round ronda actual
 * @param {object|null} summary resumen de la ronda anterior
 * @returns {Array<object>} mensajes, los importantes primero
 */
function buildInbox(state, round, summary = null) {
  counter = 0;
  const rng = makeRng(`${state.seed}|inbox|${state.series}|${round.round}`);
  const team = state.team;
  const staff = staffFor(team, state.series);
  const principalName = staff.principal?.name || 'Dirección del equipo';
  const base = {
    driver: state.driver,
    team,
    standings: state.standings,
    lastResult: summary,
    rng,
    round,
    series: state.series,
    weather: round.circuit.weather,
    corner: rng.int(3, 12),
    principal: principalName,
    rivals: state.rivals,
  };

  const drafts = [
    { role: 'principal', from: principalName, weight: 3, subject: summary ? `Después de ${round.gp}` : 'Tu primer día en el equipo' },
    { role: 'raceEngineer', from: staff.raceEngineer?.name || 'Ingeniero de carrera', weight: 2, subject: 'Datos y plan de carrera' },
    { role: 'chiefMechanic', from: staff.chiefMechanic?.name || 'Jefe de mecánicos', weight: 1, subject: 'Pit stop y neumáticos' },
    { role: 'press', from: rng.pick(PRESS_OUTLETS), weight: 1, subject: `Crónica de ${round.gp}` },
  ];
  if (rng.chance(0.35)) {
    drafts.push({ role: 'rival', from: 'Mensaje en el paddock', weight: 0, subject: rng.pick(['Antes de este fin de semana', 'Telegram del paddock', 'Mensaje directo']) });
  }
  if (rng.chance(0.3)) {
    drafts.push({ role: 'fia', from: 'Comisarios deportivos', weight: 0, subject: 'Aviso de los comisarios' });
  }

  const out = [];
  for (const d of drafts) {
    out.push(
      makeMessage({
        from: d.from,
        role: d.role,
        subject: d.subject,
        body: templateFor(d.role)(base),
        kind: round.round,
        date: round.days.thu,
        weight: d.weight,
      })
    );
  }
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

function unreadCount(inbox) {
  return inbox.filter((m) => m.unread).length;
}

function markAllRead(inbox) {
  for (const m of inbox) m.unread = false;
  return inbox;
}

/** Banderas del organigrama del equipo, para los avatares del buzón. */
function staffFlagsFor(state) {
  const staff = staffFor(state.team, state.series);
  return {
    principal: staff.principal?.flag || state.team.flag || '🏁',
    raceEngineer: staff.raceEngineer?.flag || '🏁',
    chiefMechanic: staff.chiefMechanic?.flag || '🏁',
  };
}

  __x.roleLabel = roleLabel;
  __x.roleTag = roleTag;
  __x.buildInbox = buildInbox;
  __x.unreadCount = unreadCount;
  __x.markAllRead = markAllRead;
  __x.staffFlagsFor = staffFlagsFor;
};
__registry["js/game/news.js"] = function (__x, __req) {
// Noticias de la categoría. Se generan a partir del estado real de la carrera:
// resultados del jugador, clasificación, incidentes y mercado, de modo que el
// telediario va contando la historia que está escribiendo el jugador.

const { makeRng } = __req("js/core/rng.js");
const { pos } = __req("js/core/util.js");

let counter = 0;

const TAGS = {
  player: { label: 'Tu piloto', css: 'player' },
  rival: { label: 'Clasificación', css: 'rival' },
  market: { label: 'Mercado', css: 'market' },
  technical: { label: 'Ingeniería', css: 'tech' },
  fia: { label: 'Reglamento', css: 'fia' },
};

function item({ tag, title, body, date, round, source = 'SportFeed', big = false }) {
  counter += 1;
  return { id: `n${counter}-${round}-${tag.css}`, tag: tag.css, tagLabel: tag.label, title, body, date, round, source, big };
}

const MARKET_TITLES = [
  'El mercado de fichajes se mueve',
  'Se aceleran las negociaciones',
  'Un equipo blinda a su piloto',
  'La lista de la próxima temporada toma forma',
];

const MARKET_BODIES = [
  'Varios equipos han registrado sus primeras reuniones con managers. Todavía no hay firmas, pero el mercado ya no está en calma.',
  'Fuentes cercanas al paddock confirman contactos entre equipos y representantes. Ninguna operación está cerrada.',
  'La dirección quiere cerrar los contratos de su piloto estrella antes de que empiece la segunda mitad del campeonato.',
  'Los primeros nombres de la próxima temporada siguen siendo un rumor, pero el proceso de negociación ya ha empezado.',
];

const TECH_TITLES = [
  'Ingeniería: las novedades del fin de semana',
  'Las mejoras que llegan a este circuito',
  'Neumáticos y aerodinámica: la apuesta',
  'Setup: qué se busca en este trazado',
];

const TECH_BODIES = [
  'El equipo llega con una revisión importante en el fondo. El objetivo es ganar tiempo en las curvas de alta.',
  'Se trabaja con un alerón trasero de menos deriva. En un circuito con tantas frenadas, cada metro cuenta.',
  'Neumáticos blandos extra y poco combustible. La estrategia prevista es de una sola parada.',
  'La línea de carrera es más lenta que la trazada ideal, pero más segura. El desgaste tiene prioridad.',
];

const FIA_TITLES = [
  'Los comisarios avisan sobre la zona de banderas',
  'Revisión del límite de pista en el sector final',
  'Nuevo protocolo de salida en frío',
  'La FIA actualiza el reglamento deportivo',
];

const FIA_BODIES = [
  'La FIA recuerda las normas de seguridad tras el análisis de los sectores finales del circuito.',
  'Tres pilotos citados a declarar por el uso del límite de pista. La sanción se decidirá después de la carrera.',
  'El protocolo se aplicará desde la próxima temporada y cambia la forma de entrar en boxes con el coche frío.',
  'El reglamento técnico y financiero recibe sus primeros ajustes de la temporada. Los equipos tienen hasta fin de mes para adaptarse.',
];

function resultNews(ctx) {
  const { player, position, grid, round, driverCount, retired, points, standings, team } = ctx;
  if (retired) {
    return item({
      tag: TAGS.player,
      big: true,
      title: `${player.name} abandona en ${round.gp}`,
      body: `El dorsal ${player.number} de ${team.name} se retiró en ${round.circuit.name}. De ${driverCount} coches en pista, ${Math.max(0, driverCount - 1)} llegaron a meta.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  if (position === 1) {
    const lead = standings && standings.position === 1;
    const start = grid > 1 ? `desde la posición ${grid} de la parrilla` : 'desde la pole';
    return item({
      tag: TAGS.player,
      big: true,
      title: `${player.name} gana ${round.gp}`,
      body: `Victoria ${start} en ${round.circuit.name}. ${team.name} suma ${points} puntos y ${lead ? 'el dorsal asume el liderato' : 'se acerca a la punta'}.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  if (position <= 3) {
    const champ = standings ? ` y ${pos(standings.position)} del campeonato` : '';
    return item({
      tag: TAGS.player,
      big: true,
      title: `Podio para ${player.name} en ${round.gp}`,
      body: `${pos(position)} en el podio de ${round.gp} para ${team.name}. ${points} puntos${champ}.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  if (position <= 10) {
    return item({
      tag: TAGS.player,
      title: `${player.name} termina ${pos(position)} en ${round.gp}`,
      body: `Puntos y un fin de semana razonablemente solucionado para ${team.name}. ${points} puntos en el bolso.`,
      date: round.days.sun,
      round: round.round,
    });
  }
  return item({
    tag: TAGS.player,
    title: `Carrera sin puntos para ${player.name} en ${round.gp}`,
    body: `${pos(position)} en ${round.circuit.name}. El equipo analizará el desgaste antes de la próxima cita.`,
    date: round.days.sun,
    round: round.round,
  });
}

function qualiNews(ctx) {
  const { player, pole, round, team, grid } = ctx;
  if (pole) {
    return item({
      tag: TAGS.player,
      big: true,
      title: `Pole para ${player.name} en ${round.gp}`,
      body: `Mejor tiempo de la clasificación en ${round.circuit.name}. ${team.name} sale primero y el resto de la parrilla tiene que trabajar.`,
      date: round.days.sat,
      round: round.round,
    });
  }
  if (grid && grid <= 3) {
    return item({
      tag: TAGS.player,
      title: `${player.name} sale ${pos(grid)} en ${round.gp}`,
      body: `Primera línea para ${team.name} en ${round.circuit.name}. Buena oportunidad para el domingo.`,
      date: round.days.sat,
      round: round.round,
    });
  }
  if (grid && grid <= 10) {
    return item({
      tag: TAGS.player,
      title: `${player.name} queda ${pos(grid)} en la parrilla de ${round.gp}`,
      body: `Clasificación de fondo medio para ${team.name}. Trabajo pendiente en la trazada de ${round.circuit.name}.`,
      date: round.days.sat,
      round: round.round,
    });
  }
  return null;
}

function leaderNews(ctx) {
  const { standings, round, series } = ctx;
  const table = standings?.rows;
  if (!table || !table.length) return null;
  const leader = table[0];
  const wins = leader.wins === 1 ? 'victoria' : 'victorias';
  const verb = series === 'f1' ? 'lidera el campeonato' : 'domina la categoría';
  return item({
    tag: TAGS.rival,
    title: `${leader.name} ${verb}`,
    body: `${leader.points} puntos y ${leader.wins} ${wins} en ${round.round} jornadas. La próxima cita ya está en el calendario.`,
    date: round.days.sun,
    round: round.round,
  });
}

function buildNews(state, round, summary) {
  counter = 0;
  const rng = makeRng(`${state.seed}|news|${state.series}|${round.round}`);
  const ctx = {
    player: state.driver,
    team: state.team,
    round,
    series: state.series,
    standings: state.standings,
    position: summary?.position ?? null,
    grid: summary?.grid ?? null,
    pole: Boolean(summary?.pole),
    retired: Boolean(summary?.retired),
    points: summary?.points ?? 0,
    driverCount: summary?.driverCount ?? 0,
  };

  const out = [];
  const quali = qualiNews(ctx);
  if (quali) out.push(quali);
  if (summary && (summary.position != null || summary.retired)) out.push(resultNews(ctx));
  const leader = leaderNews(ctx);
  if (leader) out.push(leader);

  out.push(item({ tag: TAGS.market, title: rng.pick(MARKET_TITLES), body: rng.pick(MARKET_BODIES), date: round.days.thu, round: round.round, source: 'Mundialsport' }));
  out.push(item({ tag: TAGS.technical, title: rng.pick(TECH_TITLES), body: rng.pick(TECH_BODIES), date: round.days.thu, round: round.round }));
  out.push(item({ tag: TAGS.fia, title: rng.pick(FIA_TITLES), body: rng.pick(FIA_BODIES), date: round.days.wed, round: round.round, source: 'FIAsport' }));

  out.sort((a, b) => Number(b.big) - Number(a.big));
  return out;
}

  __x.buildNews = buildNews;
};
__registry["js/game/race.js"] = function (__x, __req) {
﻿// Motor de sesiÃ³n:Practicas, clasificaciÃ³n (Q1/Q2/Q3) y carrera.
// Gestiona parrilla, semÃ¡foro, IA, paradas, banderas,cronometraje y resultados.

const { makeRng } = __req("js/core/rng.js");
const { buildTrack, projectCar, indexAtS, pointAtS, speedProfile, minimap } = __req("js/game/track.js");
const { makeCarState, stepCar, stepAi, applyLaunch, maxSpeed, TYRES, tyreLapsLeft, ERS_CAPACITY } = __req("js/game/car.js");
const { clamp, mod, lerp, dist: dist2d } = __req("js/core/util.js");

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Reglas de carrera â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** Toda carrera es de 20 vueltas, en F1 y en F2. */
const RACE_LAPS = 20;
/** El sprint es corto: 8 vueltas. */
const SPRINT_LAPS = 8;
/** Una sola parada en boxes, es obligatoria. */
const MAX_PIT_STOPS = 1;
/** Segundos de penalizaciÃ³n por no parar. */
const MISSED_PIT_PENALTY_S = 5;
/** NeumÃ¡ticos disponibles al salir de boxes. */
const START_TYRES = ['soft', 'medium', 'hard'];

/** Duraciones jugables (segundos) */

const DURATIONS = {
  fp: 240,
  sprintQualiSegment: 100,
  quali: [210, 175, 160],
  sprint: 165,
};

/** Pilotos que pasan de cada segmento de clasificaciÃ³n. */
const QUALI_CUTOFFS = [18, 15, 10];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ConstrucciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * Crea una sesiÃ³n jugable.
 * @param {object} config
 * @param {object} config.circuit definiciÃ³n de circuito (data/circuits.js)
 * @param {Array} config.entryList participantes
 * @param {string} config.kind 'fp' | 'quali' | 'sprint' | 'feature'
 * @param {object} config.round ronda del calendario
 * @param {object} config.settings ajustes del juego
 * @param {number} [config.seed]
 * @param {string} [config.startTyre] compuesto elegido por el jugador
 * @param {object} [config.grid] posiciÃ³n de salida ya conocida (carrera)
 * @param {Array} [config.qualifyingOrder] orden de la Q anterior
 */
function createSession(config) {
  const { circuit, entryList, kind, round, settings, grid = null, qualifyingOrder = null, seed = 1 } = config;
  const track = buildTrack(circuit);
  const rng = makeRng(`${seed}|${kind}|${round.round}`);
  const series = round.series;
  const weather = makeWeather(circuit);
  const isRace = kind === 'feature' || kind === 'sprint';

  const state = {
    kind,
    series,
    round,
    track,
    weather,
    settings,
    phase: 'formation',
    clock: 0,
    duration: 0,
    segment: 0,
    segmentsDone: [],
    eliminations: [],
    cars: [],
    player: null,
    order: [],
    grid: [],
    gridSource: grid ? 'quali' : qualifyingOrder ? 'quali' : 'grid',
    laps: 0,
    totalDistance: 0,
    raceDistance: 0,
    finished: false,
    results: null,
    lights: 0,
    lightTimer: 0,
    lightOffAt: 0,
    safetyCar: { active: false, remaining: 0, queue: [] },
    messages: [],
    fastestLap: { ms: 0, driverId: null },
    flags: { yellow: false, sc: false },
    event: null,
    pitWindowOpen: false,
    pitDistance: Infinity,
    playerPenaltyS: 0,
    maxStops: isRace ? MAX_PIT_STOPS : 2,
    completed: false,
  };

  /* Parrilla: si no hay clasificaciÃ³n previa, se ordena por skill descendente */
  let startOrder = entryList.slice();
  if (grid) {
    const pos = new Map(grid.map((e, i) => [e.driverId, i + 1]));
    startOrder = entryList.slice().sort((a, b) => (pos.get(a.driverId) || 99) - (pos.get(b.driverId) || 99));
  } else if (qualifyingOrder) {
    startOrder = qualifyingOrder.slice();
  } else {
    startOrder = entryList.slice().sort((a, b) => b.skill - a.skill + rng.gauss(0.8));
  }
  const isTimeSession = kind === 'fp' || kind === 'quali' || kind === 'sprintQuali';
  if (isTimeSession) {
    /* En practicas y clasificacion manda el crono: el jugador sale el primero y
       con pista libre. Si no, arranca el ultimo, a casi dos kilometros de la
       linea y detras de 21 coches, y la sesion no se puede jugar. */
    startOrder = startOrder.slice().sort((a, b) => (a.isPlayer ? -1 : 0) - (b.isPlayer ? -1 : 0));
  }
  state.grid = startOrder.map((e, i) => ({ driverId: e.driverId, position: i + 1 }));

  /* Distancia de carrera: 20 vueltas en todos los grandes, 8 en el sprint */
  const laps = kind === 'sprint' ? SPRINT_LAPS : kind === 'feature' ? RACE_LAPS : 0;
  state.laps = laps;
  state.fullLaps = laps;

  /* NeumÃ¡ticos iniciales: el jugador elige en la pantalla previa, la IA con su
     estrategia. En prÃ¡cticas y clasificaciÃ³n se sale siempre con blandos. */
  const defaultTyre = kind === 'feature' || kind === 'sprint' ? 'medium' : 'soft';
  const startTyre = TYRES[config.startTyre] ? config.startTyre : defaultTyre;
  /* Practicas: los coches salen en tres columnas y bien separados, como en una
     sesion real. Carrera y clasificacion: parrilla de dos en dos. */
  const spacing = kind === 'fp' ? 46 : 9.5;
  const lateral = kind === 'fp' ? 3.4 : 1.9;

  state.cars = startOrder.map((entry, i) => {
    const c = makeCarState(track, entry, { grid: i + 1, tyre: startTyre });
    c.gridPosition = i + 1;
    c.rng = rng.fork(`ai-${entry.driverId}`);
    c.strategy = makeStrategy(rng.fork(`strat-${entry.driverId}`), kind, state.laps);
    /* Colocación en pista */
    const back = kind === 'fp' ? -(i * spacing) - 150 : -(i * spacing) - 8;
    const s = mod(back, track.length);
    const p = pointAtS(track, s);
    const lat = kind === 'fp'
      ? [0, -lateral, lateral, -lateral * 2, lateral * 2][i % 5]
      : (i % 2 === 0 ? -lateral : lateral);
    c.x = p.x + p.nx * lat;
    c.y = p.y + p.ny * lat;
    c.lateral = lat;
    c.idx = indexAtS(track, s);
    c.s = s;
    c.dist = back;
    /* En carreras la parrilla está detrás de la línea pero la vuelta 1 empieza
       con la señal. En prácticas y clasificación el primer cruce sí arma el
       cronómetro: si no, la primera vuelta rápida se gasta como vuelta de
       salida y el jugador se queda sin ningún tiempo. */
    c.lap = isRace ? 0 : Math.floor(back / track.length);
    c.qualifyingLap = 0;
    c.bestLapMs = 0;
    c.lastLapMs = 0;
    c.lapStartClock = 0;
    c.sectorTimes = [0, 0, 0];
    c.sectorStart = 0;
    c.outLap = true;
    c.sector = 1;
    c.drsAllowed = false;
    c.jumpStart = false;
    c.pitDone = 0;
    c.pitStops = 0;
    c.penaltyMs = 0;
    c.pitTimerLeft = 0;
    c.pitting = false;
    c.finished = false;
    c.finishTime = 0;
    c.classified = null;
    c.mechanicalRisk = 0;
    c.intro = 1;
    c.lapArmed = kind === 'feature' || kind === 'sprint';
    c.scTarget = null;
    c.qualiHistory = [];
    c.reachedSegment = -1;
    c.eliminatedIn = -1;
    if (!entry.isPlayer) {
      c.skill = entry.skill;
      if (isRace) c.tyre = c.strategy.tyre;
    }
    return c;
  });

  state.player = state.cars.find((c) => c.isPlayer) || null;
  if (state.player) {
    const pitLap = plannedPitLap(state.laps, startTyre);
    state.player.tyre = startTyre;
    state.player.skill = state.player.skill || 78;
    state.player.strategy = {
      stops: state.maxStops,
      tyre: startTyre,
      second: secondTyreFor(state.laps - pitLap),
      pitLap,
    };
  }

  /* Distancia de carrera: 20 vueltas en todos los grandes, 8 en el sprint */
  state.totalDistance = laps > 0 ? laps * track.length : Infinity;
  state.raceDistance = laps > 0 ? (laps * track.length) / 1000 : 0;
  state.entries = entryList;
  state.entryFor = (id) => entryList.find((e) => e.driverId === id) || null;

  /* DuraciÃ³n de la sesiÃ³n */
  if (kind === 'fp') state.duration = DURATIONS.fp;
  else if (kind === 'quali') state.duration = DURATIONS.quali[0];
  else if (kind === 'sprintQuali') state.duration = DURATIONS.sprintQualiSegment;
  else state.duration = 0;

  state.speedRef = speedProfile(track, weather.wet ? 0.95 : 1);
  state.line = track.line;
  state.minimap = minimap(track);
  state.rng = rng;

  if (kind === 'fp') startPractice(state);
  else if (kind === 'quali' || kind === 'sprintQuali') startQualifying(state);
  else startRace(state);

  sortOrder(state);
  return state;
}

/** Sin gomas de lluvia por ahora: todas las sesiones se disputan en seco. */
function makeWeather(circuit) {
  const air = Math.round(lerp(24, 32, hash01(circuit.id || 'x') * 0.6));
  return {
    kind: 'dry',
    wet: false,
    rain: 0,
    air,
    track: Math.round(air + 8),
    label: 'Seco',
  };
}

/** Semilla estable a partir de un texto, para climas reproducibles. */
function hash01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Vuelta en la que la IA tiene previsto entrar a boxes. */
function plannedPitLap(laps, firstTyre) {
  if (!laps) return 0;
  const life = TYRES[firstTyre].life;
  return clamp(Math.round(laps * 0.45), 2, Math.max(2, Math.min(laps - 3, life)));
}

/**
 * Compuesto con el que se sale tras la Ãºnica parada obligatoria: el mÃ¡s rÃ¡pido
 * que aguante las vueltas que quedan hasta meta.
 */
function secondTyreFor(remainingLaps = 0) {
  const need = Math.max(0, remainingLaps);
  if (need <= TYRES.soft.life) return 'soft';
  if (need <= TYRES.medium.life) return 'medium';
  return 'hard';
}

/**
 * Estrategia de la IA: una sola parada, y el compuesto inicial tiene que llegar
 * hasta esa vuelta sin romperse.
 */
function makeStrategy(rng, kind, laps) {
  if (kind !== 'feature' && kind !== 'sprint') {
    return { stops: 0, tyre: 'soft', second: null, pitLap: 0 };
  }
  const planned = clamp(Math.round(laps * 0.45), 2, Math.max(2, laps - 3));
  /* El primer stint no puede superar la vida del compuesto */
  const pool = START_TYRES.filter((t) => TYRES[t].life >= planned - 1);
  const options = pool.length ? pool : ['medium'];
  const first = rng.weighted(options, (t) => (t === 'medium' ? 6 : t === 'hard' ? 4 : 2));
  const pitLap = clamp(planned, 2, Math.max(2, Math.min(laps - 3, TYRES[first].life)));
  return { stops: 1, tyre: first, second: secondTyreFor(laps - pitLap), pitLap };
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Arranque de cada tipo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function startPractice(state) {
  state.phase = 'running';
  state.clock = 0;
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    /* Todos salen rodando y desparramados: nadie se queda parado en la trazada
       y el jugador no arranca con 21 coches detrás a 150 km/h */
    const roll = c.isPlayer ? 34 : 38 + c.rng.float(0, 14);
    c.speed = roll;
    c.vx = Math.cos(c.angle) * c.speed;
    c.vy = Math.sin(c.angle) * c.speed;
    c.started = true;
    c.lapStartClock = 0;
    c.sectorStart = 0;
  }
  state.messages.push({ text: 'Libres: no hay límite de vueltas. Suelta el acelerador cuando quieras volver al túnel.', kind: 'info' });
}

function startQualifying(state) {
  state.phase = 'running';
  state.clock = 0;
  state.segment = 0;
  state.qualifyingRows = state.cars.map((c) => ({
    driverId: c.driverId,
    name: c.name,
    teamId: c.teamId,
    number: c.number,
    flag: c.flag,
    team: c.color,
    car: c,
    bestLapMs: 0,
    position: 0,
    grid: 0,
    eliminated: false,
  }));
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    /* También en clasificación se sale rodando: parado en la parrilla, el
       jugador solo sufre el tren de coches que le llega detrás */
    const roll = c.isPlayer ? 30 : 34 + c.rng.float(0, 12);
    c.speed = roll;
    c.vx = Math.cos(c.angle) * c.speed;
    c.vy = Math.sin(c.angle) * c.speed;
    c.started = true;
    c.lapStartClock = 0;
    c.sectorStart = 0;
  }
  const label = state.kind === 'sprintQuali' ? 'Shootout' : `Q${state.segment + 1}`;
  state.messages.push({ text: `${label}: pasa el corte el mejor tiempo. Tienes ${Math.round(state.duration / 60)} min.`, kind: 'quali' });
}

function startRace(state) {
  state.phase = 'countdown';
  state.lights = 0;
  /* Las cinco luces rojas se encienden una a una: cuando se apagan, todos salen */
  state.lightTimer = 3.2;
  state.lightOffAt = 0;
  state.clock = 0;
  const rng = state.rng;
  for (const c of state.cars) {
    const p = pointAtS(state.track, c.s);
    c.angle = Math.atan2(p.dirY, p.dirX);
    c.speed = 0;
    c.vx = 0;
    c.vy = 0;
    c.lapStartClock = 0;
    c.sectorStart = 0;
    c.sector = 1;
    c.reactionRoll = rng.next();
  }
  const tyre = TYRES[state.player?.tyre || 'medium'];
  state.messages.push({
    text: `Parrilla: ${state.cars.length} coches, ${state.laps} vueltas y una parada obligatoria. NeumÃ¡tico ${tyre.name}.`,
    kind: 'start',
  });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Bucle principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * Avanza la sesiÃ³n.
 * @param {object} state
 * @param {number} dt segundos reales
 * @param {object|null} input estado de conducciÃ³n del jugador
 */
function updateSession(state, dt, input) {
  if (state.completed) return;
  const { track, settings } = state;
  const isRace = state.kind === 'feature' || state.kind === 'sprint';
  const substeps = clamp(Math.ceil(dt / (1 / 90)), 1, 6);
  const h = dt / substeps;

  for (let k = 0; k < substeps; k++) {
    state.clock += h;
    if (state.phase === 'countdown') tickCountdown(state, h);
    tickCars(state, h, input, isRace);
    if (isRace) tickRaceProgress(state, h);
    else tickSessionProgress(state, h);
  }
  sortOrder(state);
  updateGaps(state);
  consumeEdgeInput(state, input);
}

function tickCountdown(state, dt) {
  state.lightTimer -= dt;
  if (state.lightTimer > 0) return;
  if (state.lights < 5) {
    state.lights += 1;
    /* Entre luz y luz hay algo menos de un segundo, como en la FIA */
    state.lightTimer = 0.75 + state.rng.float(0, 0.45);
    if (state.lights === 5) state.lightTimer = 1.1 + state.rng.float(0, 0.9);
    return;
  }
  /* Las cinco estÃ¡n encendidas: se apagan todas y la carrera sale */
  state.phase = 'green';
  state.greenAt = state.clock;
  state.greenTimer = state.rng.float(0.7, 1.5);
  state.lights = 0;
  state.lightOffAt = state.clock;
  state.startedAt = state.clock;
  state.messages.push({ text: 'Â¡SemÃ¡foro verde! Todos fuera.', kind: 'green' });
}

function tickCars(state, dt, input, isRace) {
  const { track, settings, weather } = state;
  const list = state.cars.filter((c) => !c.retired && !c.finished);
  const refs = buildAiRefs(state);
  const assists = {
    steeringAssist: settings?.steeringAssist ?? 0.4,
    autoDrs: settings?.autoDrs !== false,
  };

  for (const car of list) {
    if (state.phase === 'formation' || state.phase === 'countdown') {
      if (!car.isPlayer) {
        car.speed = 0;
        continue;
      }
      const pg = pointAtS(track, car.s);
      car.x = pg.x + pg.nx * car.lateral;
      car.y = pg.y + pg.ny * car.lateral;
      car.angle = Math.atan2(pg.dirY, pg.dirX);
      car.speed = 0;
      if (input && (input.throttle > 0.2 || input.brake > 0.2) && state.lights >= 5) car.jumpStart = true;
      continue;
    }
    if (car.pitting) {
      tickPit(state, car, dt);
      continue;
    }
    if (car.isPlayer) {
      if (!car.started && state.greenAt != null && state.clock > state.greenAt) {
        const good = Boolean(input && input.throttle > 0.15);
        const wasJump = car.jumpStart;
        applyLaunch(car, track, wasJump ? 0.12 : good ? 1 : 0.4, state.rng);
        car.jumpStart = false;
        car.started = true;
        car.lapStartClock = state.clock;
        car.sectorStart = state.clock;
        state.messages.push({
          text: wasJump ? 'Salida anticipada: penalizaciÃ³n de la FIA.' : 'SemÃ¡foro verde, adelante.',
          kind: wasJump ? 'penalty' : 'green',
        });
      }
      const proj = projectCar(track, car.x, car.y, car.idx);
      car.proj = proj;
      stepCar(car, { steer: input?.steer || 0, throttle: input?.throttle || 0, brake: input?.brake || 0, drsPressed: Boolean(input?.drsPressed) }, track, proj, {
        dt,
        weather,
        assists,
        autoDrs: assists.autoDrs,
      });
      car.idx = proj.idx;
      car.s = proj.s;
      car.lateral = proj.lateral;
      car.onTrack = proj.onTrack;
      car.kerb = proj.kerb;
      car.dist += car.speed * dt;
      collideWithField(state, car);
    } else {
      const ref = refs.get(car.driverId);
      stepAi(car, {
        dt,
        track,
        line: state.line,
        weather,
        rng: car.rng,
        skill: car.skill,
        scActive: state.safetyCar.active,
        avoiding: ref?.ahead !== undefined,
        avoidLateral: ref?.avoid,
        defendLateral: ref?.defend,
      });
      if (!car.started) {
        const good = car.reactionRoll < 0.22 + car.skill / 430;
        /* La ventana de arranque se mide desde el verde, no por fase: si el
           semÃ¡foro ya pasÃ³ a verde-perdido, quien reaccionÃ³ tarde aÃºn sale */
        const elapsed = state.greenAt == null ? 0 : state.clock - state.greenAt;
        if (elapsed > 0 && (good || elapsed > 1.5)) {
          applyLaunch(car, track, good ? 0.9 : 0.35, car.rng);
          car.started = true;
          car.lapStartClock = state.clock;
          car.sectorStart = state.clock;
        } else {
          car.speed = 0;
        }
        continue;
      }
      car.dist += car.speed * dt;
      collideWithField(state, car);
    }
  }
  if (state.phase === 'green' && state.greenTimer > 0) {
    state.greenTimer -= dt;
    if (state.greenTimer <= 0) state.phase = 'running';
  }
}

/** Referencias para que la IA se desvÃ­e y defienda. */
function buildAiRefs(state) {
  const refs = new Map();
  const live = state.cars.filter((c) => !c.retired && !c.finished && c.started);
  for (const c of live) {
    let avoid = 0;
    let defend = 0;
    let found = false;
    for (const o of live) {
      if (o === c || o.retired) continue;
      const gap = c.dist - o.dist;
      /* Solo estorban los coches que estÃ¡n delante y en la misma trazada */
      const lat = Math.abs(c.lateral - o.lateral);
      if (gap > 0 && gap < 30 && lat < 3.4) {
        found = true;
        const strength = (1 - gap / 30) * (1 - lat / 3.4) * 4.6;
        avoid += (o.lateral > c.lateral ? -1 : 1) * strength;
      } else if (gap < 0 && gap > -16 && lat < 2.6) {
        const strength = (1 + gap / 16) * (1 - lat / 2.6) * 2.4;
        defend += (c.lateral > 0 ? -1 : 1) * strength;
      }
    }
    if (Math.abs(avoid) > 0.1 || Math.abs(defend) > 0.1) refs.set(c.driverId, { avoid, defend, ahead: found });
  }
  return refs;
}

/* Un monoplaza mide unos 2 m de ancho: dos coches en fila no estÃ¡n tocÃ¡ndose */
const CAR_CONTACT = 2.6;

/** Contacts between cars: lateral push, no violent crashes. */
function collideWithField(state, car) {
  for (const other of state.cars) {
    if (other === car || other.retired || other.finished) continue;
    const d = dist2d(car.x, car.y, other.x, other.y);
    if (d > CAR_CONTACT || d < 0.0001) continue;
    const nx = (car.x - other.x) / d;
    const ny = (car.y - other.y) / d;
    const overlap = CAR_CONTACT - d;
    const push = overlap * 0.5;
    car.x += nx * push;
    car.y += ny * push;
    if (!other.isPlayer) {
      other.x -= nx * push * 0.7;
      other.y -= ny * push * 0.7;
    }
    /* Transfer of speed: el que viene por detrÃ¡s pierde, y solo en la medida
       del solape, para que un tren de coches no frene a todos cada fotograma */
    const closing = car.speed - other.speed;
    if (closing > 3) {
      const loss = Math.min(closing * 0.18, 3.4 * overlap);
      car.speed = Math.max(0, car.speed - loss);
      other.speed = Math.min(maxSpeed(other.car, other.drsOpen), other.speed + loss * 0.25);
      if (car.isPlayer) {
        car.damage = clamp(car.damage + 0.015 * overlap, 0, 1);
        if (car.speed < 6) state.messages.push({ text: 'Toque: cuidado con el coche de al lado.', kind: 'warn' });
      }
    }
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Progreso: vueltas, sectores, banderas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function tickSessionProgress(state, dt) {
  /* Solo las sesiones de clasificaciÃ³n se cortan por tiempo: las carreras y los
     sprints terminan cuando el lÃ­der cruza la meta (vÃ©ase finishRacers) */
  const isQuali = state.kind === 'quali' || state.kind === 'sprintQuali';
  if (state.phase !== 'running') return;

  /* Vueltas cronometradas en ambas modalidades */
  for (const c of state.cars) {
    if (c.retired) continue;
    const lapNow = Math.floor(c.dist / state.track.length);
    if (lapNow <= c.lap) continue;
    c.lap = lapNow;
    if (!c.lapArmed) {
      /* Vuelta de salida: no cuenta */
      c.lapArmed = true;
      c.lapStartClock = state.clock;
      c.sectorStart = state.clock;
      c.sector = 1;
      c.outLap = false;
      continue;
    }
    const lapMs = Math.round((state.clock - c.lapStartClock) * 1000);
    if (lapMs > 4000) {
      c.lastLapMs = lapMs;
      c.qualifyingLap += 1;
      if (isQuali) c.qualiHistory.push({ segment: state.segment, ms: lapMs });
      if (!c.bestLapMs || lapMs < c.bestLapMs) c.bestLapMs = lapMs;
      if (c.isPlayer) {
        const improved = lapMs === c.bestLapMs;
        state.messages.push({
          text: `${isQuali ? 'Vuelta' : 'Vuelta de libres'} ${c.lap}: ${formatMs(lapMs)}${improved ? ' (mejor)' : ''}`,
          kind: improved ? 'good' : 'info',
        });
      }
      if (c.bestLapMs && (!state.fastestLap.ms || c.bestLapMs < state.fastestLap.ms)) {
        state.fastestLap = { ms: c.bestLapMs, driverId: c.driverId, name: c.name };
      }
      c.lapStartClock = state.clock;
      c.sectorStart = state.clock;
      c.sector = 1;
      c.outLap = false;
    }
  }

  if (isQuali) {
    if (state.qualifyingRows && state.clock >= state.duration) closeQualifyingSegment(state);
  } else if (state.kind === 'fp' && state.clock >= state.duration) {
    finishSession(state);
  }
}

function closeQualifyingSegment(state) {
  const { track } = state;
  const rows = state.qualifyingRows.map((r) => {
    const best = r.car.bestLapMs || 0;
    const dist = r.car.retired ? -1 : r.car.dist;
    return { ...r, bestLapMs: best, dist };
  });
  rows.sort((a, b) => {
    if (!a.bestLapMs && !b.bestLapMs) return b.dist - a.dist;
    if (!a.bestLapMs) return 1;
    if (!b.bestLapMs) return -1;
    return a.bestLapMs - b.bestLapMs;
  });
  rows.forEach((r, i) => {
    r.position = i + 1;
  });

  const total = state.cars.filter((c) => !c.retired).length || rows.length;
  const isShootout = state.kind === 'sprintQuali';
  const segments = isShootout ? 2 : 3;
  const current = state.segment;
  /* Cortes reales: Q1 18, Q2 15, Q3 10; Shootout 8 y 8 */
  const cutoff = isShootout ? 8 : QUALI_CUTOFFS[current] || 10;
  const advancing = rows.slice(0, Math.min(cutoff, total));

  state.segmentsDone.push({
    segment: current,
    label: isShootout ? `Shootout ${current + 1}` : `Q${current + 1}`,
    rows: rows.map((r) => ({ ...r, car: undefined, eliminated: !advancing.includes(r) })),
  });

  const eliminated = rows.slice(advancing.length);
  for (const r of eliminated) {
    r.car.eliminated = true;
    r.car.retired = true;
    r.car.retireReason = 'eliminado';
    r.car.eliminatedIn = current;
  }
  for (const r of advancing) r.car.reachedSegment = current;

  if (current + 1 >= segments) {
    const order = advancing.map((r) => state.entryFor(r.driverId)).filter(Boolean);
    finishSession(state, {
      grid: advancing.map((r) => ({ driverId: r.driverId, position: r.position })),
      qualifyingOrder: order,
    });
    return;
  }

  /* Siguiente segmento: solo siguen los clasificados */
  state.qualifyingRows = advancing.slice();
  state.segment = current + 1;
  state.clock = 0;
  state.duration = isShootout ? DURATIONS.sprintQualiSegment : DURATIONS.quali[state.segment];
  for (const r of advancing) {
    r.car.bestLapMs = 0;
    r.car.lap = Math.floor(r.car.dist / track.length);
    r.car.lapArmed = false;
    r.car.lapStartClock = 0;
    r.car.sectorStart = 0;
    r.car.outLap = true;
  }
  state.messages.push({ text: `Corte de ${isShootout ? 'Shootout' : `Q${current + 1}`}: ${eliminated.length} pilotos eliminados.`, kind: 'quali' });
}

function tickRaceProgress(state, dt) {
  const { track } = state;
  if (state.phase === 'formation' || state.phase === 'countdown') return;
  pitAdvice(state);

  for (const c of state.cars) {
    if (c.retired) continue;

    /* Vuelta completada */
    const lapNow = Math.floor(Math.max(0, c.dist) / track.length);
    if (lapNow > c.lap) {
      c.lap = lapNow;
      const lapMs = Math.round((state.clock - c.lapStartClock) * 1000);
      c.lastLapMs = lapMs;
      if (!c.bestLapMs || lapMs < c.bestLapMs) c.bestLapMs = lapMs;
      if (c.bestLapMs && (!state.fastestLap.ms || c.bestLapMs < state.fastestLap.ms)) {
        state.fastestLap = { ms: c.bestLapMs, driverId: c.driverId, name: c.name };
      }
      c.lapStartClock = state.clock;
      c.sectorStart = state.clock;
      c.sector = 1;
      if (c.isPlayer) {
        const total = state.laps;
        const left = tyreLapsLeft(c.tyre, c.tyreWear);
        state.messages.push({
          text: `Vuelta ${c.lap}/${total} Â· ${formatMs(lapMs)} Â· ${TYRES[c.tyre].name} (${left.toFixed(1)} vueltas)${c.lap === 1 ? ' (vuelta rÃ¡pida)' : ''}`,
          kind: c.bestLapMs === lapMs ? 'good' : 'info',
        });
        if (state.safetyCar.active) state.messages.push({ text: 'Cierre del coche de seguridad. Acelera.', kind: 'sc' });
      }
      aiPitLogic(state, c);
      maybeMechanical(state, c);
    }

    /* Bandera a cuadros */
    if (!c.finished && c.dist >= state.totalDistance) {
      c.finished = true;
      c.finishTime = state.clock;
      c.classified = c.position;
    /* La parada es obligatoria: el que cruza sin parar pierde cinco segundos */
    if (c.pitStops < state.maxStops) {
      c.penaltyMs = MISSED_PIT_PENALTY_S * 1000;
      c.penaltyAdded = true;
      if (c.isPlayer) {
        state.playerPenaltyS = MISSED_PIT_PENALTY_S;
        state.messages.push({
          text: `Bandera a cuadros sin parar: +${MISSED_PIT_PENALTY_S} s de penalizaciÃ³n en la clasificaciÃ³n.`,
          kind: 'penalty',
        });
      }
    } else if (c.isPlayer) {
      state.messages.push({ text: 'Bandera a cuadros: entras en boxes y terminas la vuelta lenta.', kind: 'finish' });
    }
    }

    /* IA: una vez finishes, circulates at slower pace */
    if (c.finished && !c.isPlayer) {
      c.speed = Math.min(c.speed, 42);
    }
  }

  if (state.safetyCar.active) {
    state.safetyCar.remaining -= dt;
    for (const c of state.cars) {
      if (c.retired || c.finished) continue;
      c.scTarget = 22 + (c.skill - 70) / 12;
    }
    if (state.safetyCar.remaining <= 0) {
      exitSafetyCar(state);
      for (const c of state.cars) c.scTarget = null;
    }
  }

  if (state.player && state.player.finished && state.clock - state.player.finishTime > 22) finishSession(state);
  if (state.order.every((c) => c.retired || c.finished) && state.clock > 6) finishSession(state);
  if (!state.safetyCar.active && state.cars.filter((c) => !c.retired).length === 0) finishSession(state);
}

function aiPitLogic(state, c) {
  const st = c.strategy;
  /* El jugador entra en boxes cuando pulsa P, nunca automÃ¡ticamente */
  if (c.isPlayer) return;
  if (!st || st.stops === 0 || c.retired || c.finished) return;
  const plannedLap = st.pitLap || Math.round(state.laps * 0.45);
  /* Ajuste por Conductividad: los coches rÃ¡pidos entran algo antes */
  const lap = c.lap + (c.skill > 84 ? 0 : c.skill < 74 ? 1 : 0);
  if (lap >= plannedLap && c.pitDone < st.stops && c.dist > trackLapDistance(state)) {
    enterPit(state, c, true);
  }
}

function trackLapDistance(state) {
  return state.track.length * 0.4;
}

/** Avisa al jugador de la parada obligatoria y de la vida que le queda. */
function pitAdvice(state) {
  const p = state.player;
  if (!p || p.retired || p.finished || state.kind !== 'feature' && state.kind !== 'sprint') return;
  if (p.pitStops >= state.maxStops) {
    if (p.pitAdvice !== 'done') {
      p.pitAdvice = 'done';
      state.messages.push({ text: 'Parada hecha. A la vuelta con el compound nuevo.', kind: 'pit' });
    }
    return;
  }
  const left = tyreLapsLeft(p.tyre, p.tyreWear);
  const remaining = Math.max(0, state.laps - p.lap);
  if (left <= 2.2 && remaining > 1) {
    if (p.pitAdvice !== 'now') {
      p.pitAdvice = 'now';
      state.messages.push({ text: `Â¡NeumÃ¡tico al lÃ­mite! Entra en boxes (te quedan ${left.toFixed(1)} vueltas de vida).`, kind: 'pit' });
    }
  } else if (remaining <= 6 && p.pitAdvice !== 'late') {
    p.pitAdvice = 'late';
    state.messages.push({ text: `Quedan ${remaining} vueltas y aÃºn no has parado: penalizaciÃ³n de ${MISSED_PIT_PENALTY_S} s.`, kind: 'penalty' });
  }
}

function maybeMechanical(state, c) {
  if (c.retired || c.finished) return;
  const base = (100 - c.car.reliability) / 100;
  const risk = base * 0.012 * (0.4 + c.damage);
  if (state.rng.next() < risk) {
    retireCar(state, c, 'averÃ­a mecÃ¡nica');
  } else if (c.damage >= 0.92 && state.rng.next() < 0.25) {
    retireCar(state, c, 'daÃ±o irreparable');
  }
}

function retireCar(state, car, reason) {
  if (car.retired) return;
  car.retired = true;
  car.retireReason = reason;
  car.speed = 0;
  if (car.isPlayer) {
    state.messages.push({ text: `Abandono: ${reason}. Pulsa Intro para volver al menÃº.`, kind: 'dnf' });
    state.playerOut = true;
  } else {
    state.messages.push({ text: `${car.name} abandona (${reason}).`, kind: 'other' });
  }
  checkSafetyCar(state, car);
}

function checkSafetyCar(state, culprit) {
  if (state.kind !== 'feature' && state.kind !== 'sprint') return;
  if (state.safetyCar.active) return;
  const live = state.cars.filter((c) => !c.retired && !c.finished && c.dist > 0);
  if (live.length < 6) return;
  const near = live.filter((c) => Math.abs(c.dist - culprit.dist) < 260);
  if (near.length >= 3 && state.rng.chance(0.65)) {
    deploySafetyCar(state);
  }
}

function deploySafetyCar(state) {
  state.safetyCar.active = true;
  state.safetyCar.remaining = 42 + state.rng.float(0, 22);
  state.flags.sc = true;
  state.flags.yellow = false;
  state.messages.push({ text: 'BANDERA AMARILLA - COCHE DE SEGURIDAD EN PISTA', kind: 'sc' });
}

function exitSafetyCar(state) {
  state.safetyCar.active = false;
  state.flags.sc = false;
  state.messages.push({ text: 'Pista verde. Se reanuda la carrera.', kind: 'green' });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Parada en boxes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function enterPit(state, car, forced = false) {
  if (car.pitting) return false;
  const maxStops = state.maxStops ?? MAX_PIT_STOPS;
  if (car.pitStops >= maxStops) {
    if (car.isPlayer) {
      state.messages.push({
        text: maxStops === 1 ? 'Solo puedes parar una vez: la parada obligatoria ya estÃ¡ hecha.' : 'No te quedan mÃ¡s paradas en esta sesiÃ³n.',
        kind: 'warn',
      });
    }
    return false;
  }
  if (!forced && car.speed > 34) return false;
  const newTyre = nextTyre(car.strategy, car);
  car.pitting = true;
  car.pitTimerLeft = forced ? 2.6 + state.rng.float(0, 1.2) : 2.2;
  car.pitStops += 1;
  car.pitDone = (car.pitDone || 0) + 1;
  car.pitLap = Math.max(1, Math.floor(car.dist / state.track.length));
  if (car.isPlayer) {
    state.messages.push({ text: `Parada en boxes: montamos ${TYRES[newTyre].name} (vida ${TYRES[newTyre].life} vueltas).`, kind: 'pit' });
  }
  return true;
}

function tickPit(state, car, dt) {
  car.pitTimerLeft -= dt;
  car.speed = Math.min(car.speed, 22.2);
  /* Se sigue el trazado real de la calle de boxes, no un offset fijo */
  const path = state.track.pit.path;
  let target = path[0];
  let best = Infinity;
  for (const q of path) {
    const d = (q.x - car.x) * (q.x - car.x) + (q.y - car.y) * (q.y - car.y);
    if (d < best) {
      best = d;
      target = q;
    }
  }
  const k = Math.min(1, dt * 5);
  car.x = lerp(car.x, target.x, k);
  car.y = lerp(car.y, target.y, k);
  car.angle = Math.atan2(target.y - car.y, target.x - car.x);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.inPit = true;
  if (car.pitTimerLeft <= 0) {
    car.pitting = false;
    car.inPit = false;
    car.tyre = nextTyre(car.strategy, car);
    car.tyreWear = 0;
    car.tyreAge = 0;
    car.lapDist = 0;
    car.tyreTemp = 0.3;
  }
}

/* Con una sola parada el compuesto nuevo es el que fija la estrategia. */
function nextTyre(strategy, car) {
  if (!strategy) return car?.isPlayer ? secondTyreFor(0) : 'medium';
  if (car.pitDone <= 1) return strategy.second || secondTyreFor(strategy.tyre);
  return 'soft';
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Entrada del jugador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function consumeEdgeInput(state, input) {
  if (!input) return;
  if (input.pitPressed) {
    const p = state.player;
    if (p && !p.retired) {
      const near = state.track.pit;
      const d = nearPitDistance(state.track, p.x, p.y);
      if (d < near.halfWidth + 14 || p.speed < 12) enterPit(state, p);
      else state.messages.push({ text: 'Pit stop: acÃ©rcate mÃ¡s a la entrada de boxes.', kind: 'warn' });
    }
  }
  if (input.rescue) {
    const p = state.player;
    if (p && !p.retired) rescue(state, p);
  }
}

function nearPitDistance(track, x, y) {
  let best = Infinity;
  for (const q of track.pit.path) {
    const d = dist2d(x, y, q.x, q.y);
    if (d < best) best = d;
  }
  return best;
}

function rescue(state, car) {
  const track = state.track;
  const s = mod(car.dist, track.length);
  const idx = indexAtS(track, s);
  const p = track.points[idx];
  car.x = p.x;
  car.y = p.y;
  car.lateral = 0;
  car.vx = 0;
  car.vy = 0;
  car.speed = Math.min(car.speed, 22);
  car.angle = Math.atan2(p.dirY, p.dirX);
  car.damage = clamp(car.damage * 0.5, 0, 1);
  if (car.isPlayer) state.messages.push({ text: 'Coche recuperado por el equipo de seguridad.', kind: 'info' });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Orden, posiciones y diferencias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function sortOrder(state) {
  const list = state.cars.slice();
  list.sort((a, b) => {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    /* Quien no parÃ³ pierde cinco segundos depenalizaciÃ³n */
    if (a.finished && b.finished) {
      return a.finishTime + (a.penaltyMs || 0) - (b.finishTime + (b.penaltyMs || 0));
    }
    return b.dist - a.dist;
  });
  list.forEach((c, i) => {
    c.position = i + 1;
  });
  state.order = list;
}

function updateGaps(state) {
  const list = state.order.filter((c) => !c.retired);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const ahead = i > 0 ? list[i - 1] : null;
    const behind = i < list.length - 1 ? list[i + 1] : null;
    const v = Math.max(12, c.speed);
    if (ahead && ahead.finished && c.finished) {
      const t = (ahead.finishTime + (ahead.penaltyMs || 0)) - (c.finishTime + (c.penaltyMs || 0));
      c.gaps.ahead = Math.max(0, t);
      c.intervalMs = Math.round(t * 1000);
    } else {
      c.gaps.ahead = ahead ? (ahead.dist - c.dist) / v : 0;
      c.intervalMs = ahead ? Math.round((ahead.dist - c.dist) * 1000 / v) : 0;
    }
    c.gaps.behind = behind ? (c.dist - behind.dist) / Math.max(12, behind.speed) : 0;
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Cierre â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function finishSession(state, extra = {}) {
  if (state.completed) return;
  state.completed = true;
  state.phase = 'finished';
  if (state.safetyCar.active) exitSafetyCar(state);

  const isRace = state.kind === 'feature' || state.kind === 'sprint';
  if (extra.grid) state.grid = extra.grid;
  const grid = state.grid || [];
  const gridPosOf = new Map(grid.map((g) => [g.driverId, g.position]));

  let entries;
  if (isRace) {
    /* La parada es obligatoria: al cerrar la sesiÃ³n se comprueba que todo el
       que haya cruzado meta la haya hecho, y se aplica la penalizaciÃ³n */
    for (const c of state.cars) {
      if (!c.finished || c.pitStops >= state.maxStops) continue;
      c.penaltyMs = MISSED_PIT_PENALTY_S * 1000;
      if (c.isPlayer) state.playerPenaltyS = MISSED_PIT_PENALTY_S;
    }
    sortOrder(state);
    state.order.forEach((c) => { c.classified = c.position; });
    /* El intervalo en carrera es la distancia recorrida; en la clasificaciÃ³n
       final lo que cuenta es el tiempo de meta, y el resto va por intervalos */
    const leader = state.order[0];
    const leaderFinish = (leader.finishTime || state.clock) + (leader.penaltyMs || 0);
    entries = state.order.map((c, i) => {
      const fl = state.fastestLap.driverId === c.driverId ? 1 : 0;
      let gapMs = null;
      if (i === 0) gapMs = 0;
      else if (c.finished && leader.finished) gapMs = Math.round((c.finishTime + (c.penaltyMs || 0) - leaderFinish) * 1000);
      else if (!c.retired) gapMs = c.intervalMs;
      return {
        driverId: c.driverId,
        teamId: c.teamId,
        name: c.name,
        short: c.short,
        number: c.number,
        flag: c.flag,
        color: c.color,
        team: c.teamId,
        position: i + 1,
        grid: gridPosOf.get(c.driverId) || c.gridPosition,
        laps: c.lap,
        bestLapMs: c.bestLapMs,
        lastLapMs: c.lastLapMs,
        fastestLap: Boolean(fl),
        pitStops: c.pitStops,
        penaltyMs: c.penaltyMs || 0,
        tyre: c.tyre,
        dsq: c.retired,
        retired: c.retired,
        retireReason: c.retireReason,
        finished: c.finished,
        gapMs,
      };
    });
  } else if (state.kind === 'fp') {
    const rows = state.cars
      .slice()
      .sort((a, b) => (b.bestLapMs || Infinity) - (a.bestLapMs || Infinity) || a.dist - b.dist);
    entries = rows.map((c, i) => ({
      driverId: c.driverId,
      teamId: c.teamId,
      name: c.name,
      short: c.short,
      number: c.number,
      flag: c.flag,
      color: c.color,
      position: i + 1,
      grid: 0,
      bestLapMs: c.bestLapMs,
      lastLapMs: c.lastLapMs,
      laps: c.lap,
      fastestLap: state.fastestLap.driverId === c.driverId,
      pitStops: c.pitStops,
      dsq: !c.bestLapMs,
    }));
  } else {
    /* ClasificaciÃ³n final: todos los pilotos, ordenados por el segmento
       mÃ¡s profundo al que llegaron y por su mejor tiempo en Ã©l */
    const last = state.segmentsDone[state.segmentsDone.length - 1];
    const gridPos = new Map((last?.rows || []).slice(0, 10).map((r) => [r.driverId, r.position]));
    const rows = state.cars.slice().sort((a, b) => {
      const sa = a.reachedSegment;
      const sb = b.reachedSegment;
      if (sa !== sb) return sb - sa;
      const ta = a.bestLapMs || (a.qualiHistory.length ? Math.min(...a.qualiHistory.map((h) => h.ms)) : 0) || Infinity;
      const tb = b.bestLapMs || (b.qualiHistory.length ? Math.min(...b.qualiHistory.map((h) => h.ms)) : 0) || Infinity;
      return ta - tb;
    });
    entries = rows.map((c, i) => ({
      driverId: c.driverId,
      teamId: c.teamId,
      name: c.name,
      short: c.short,
      number: c.number,
      flag: c.flag,
      color: c.color,
      position: i + 1,
      grid: gridPos.get(c.driverId) || 0,
      bestLapMs: c.bestLapMs,
      lastLapMs: c.lastLapMs,
      fastestLap: state.fastestLap.driverId === c.driverId,
      pitStops: 0,
      dsq: !c.bestLapMs && !c.qualiHistory.length,
      eliminated: c.reachedSegment < (state.segmentsDone.length - 1),
      segment: c.reachedSegment + 1,
    }));
  }

  state.results = {
    sessionId: state.round.sessions.find((s) => s.type === state.kind || (state.kind === 'feature' && s.type === 'feature'))?.id || state.kind,
    kind: state.kind,
    order: 0,
    entries,
    fastestLapDriverId: state.fastestLap.driverId,
    fastestLapMs: state.fastestLap.ms,
    playerPosition: entries.find((e) => e.driverId === 'player')?.position || null,
    playerGrid: gridPosOf.get('player') || null,
    laps: state.laps,
    weather: state.weather,
    retired: state.playerOut ? true : entries.find((e) => e.driverId === 'player')?.dsq || false,
    ...extra,
  };
}

/** Obliga a terminar la sesiÃ³n (el jugador pulsa Intro en el podio). */
function endSessionNow(state) {
  finishSession(state);
  return state.results;
}

function formatMs(ms) {
  if (!ms || ms <= 0) return '--.---';
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
}




  __x.TYRES = TYRES;
  __x.ERS_CAPACITY = ERS_CAPACITY;
  __x.RACE_LAPS = RACE_LAPS;
  __x.SPRINT_LAPS = SPRINT_LAPS;
  __x.MAX_PIT_STOPS = MAX_PIT_STOPS;
  __x.MISSED_PIT_PENALTY_S = MISSED_PIT_PENALTY_S;
  __x.START_TYRES = START_TYRES;
  __x.DURATIONS = DURATIONS;
  __x.QUALI_CUTOFFS = QUALI_CUTOFFS;
  __x.createSession = createSession;
  __x.updateSession = updateSession;
  __x.retireCar = retireCar;
  __x.deploySafetyCar = deploySafetyCar;
  __x.enterPit = enterPit;
  __x.rescue = rescue;
  __x.endSessionNow = endSessionNow;
  __x.formatMs = formatMs;
};
__registry["js/game/standings.js"] = function (__x, __req) {
// Campeonato: puntos, clasificaciones de pilotos y equipos e historial de podios.
// Todo se deriva de un array de resultados ya calculados, de modo que la simulación
// de las IA y los resultados del jugador se mezclan sin código especial.

const { POINTS_TABLE, FASTEST_LAP_POINT, roundsFor } = __req("js/data/calendar.js");
const { teamsFor } = __req("js/data/teams.js");

/**
 * Un resultado de sesión (carrera o sprint) ya ordenado por posición.
 * @typedef {{entries: Array<{driverId:string,teamId:string,position:number,lapMs:number,
 *   bestLapMs:number,grid:number,fastestLap:boolean,pitStops:number,dsq?:boolean}>,
 *   fastestLapDriverId?:string}} SessionResult
 */

function pointsForPosition(position) {
  if (position < 1) return 0;
  return POINTS_TABLE[position - 1] || 0;
}

/** Añade el punto de vuelta rápida al piloto que la hizo, si positions vale. */
function scoreSession(result) {
  const out = [];
  let fastestGiven = false;
  for (const e of result.entries) {
    let pts = e.dsq ? 0 : pointsForPosition(e.position);
    if (!e.dsq && e.fastestLap && !fastestGiven) {
      pts += FASTEST_LAP_POINT;
      fastestGiven = true;
    }
    out.push({ ...e, points: pts });
  }
  return out;
}

function gridString(position) {
  return position === 1 ? 'pole' : `P${position}`;
}

/* ─────────────────────── Clasificaciones ─────────────────────── */

function buildTable(rows) {
  return rows
    .map((r) => ({ ...r, points: Math.round(r.points * 100) / 100 }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || b.best - a.best);
}

/**
 * Construye las clasificaciones de championship a partir del historial.
 * @param {string} series
 * @param {Array<{round:number, results: SessionResult[], driverMeta:Object}>} history
 */
function buildStandings(series, history, driversMeta) {
  const rows = new Map();
  for (const [id, meta] of Object.entries(driversMeta)) {
    rows.set(id, {
      driverId: id,
      teamId: meta.teamId,
      name: meta.name,
      flag: meta.flag,
      short: meta.short,
      color: meta.color,
      points: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      top10: 0,
      races: 0,
      best: 0,
      dnfs: 0,
      trend: [],
    });
  }

  const teamRows = new Map();
  const ensureTeam = (id) => {
    if (!teamRows.has(id)) {
      const t = teamsFor(series).find((x) => x.id === id) || { id, name: id, livery: { primary: '#888' } };
      teamRows.set(id, { teamId: id, name: t.name, livery: t.livery, points: 0, wins: 0, podiums: 0 });
    }
    return teamRows.get(id);
  };

  for (const round of history) {
    const main = round.results.find((r) => r.kind === 'feature');
    if (!main) continue;
    const scored = scoreSession(main);
    for (const e of scored) {
      const row = rows.get(e.driverId);
      if (!row) continue;
      row.races += 1;
      row.points += e.points;
      row.trend.push(e.position);
      if (e.position === 1) row.wins += 1;
      if (e.position <= 3) row.podiums += 1;
      if (e.position <= 10) row.top10 += 1;
      if (e.position > 10 || e.dsq) row.dnfs += 1;
      if (e.grid === 1) row.poles += 1;
      if (e.bestLapMs && (!row.best || e.bestLapMs < row.best)) row.best = e.bestLapMs;
      const team = ensureTeam(e.teamId);
      team.points += e.points;
      if (e.position === 1) team.wins += 1;
      if (e.position <= 3) team.podiums += 1;
    }
  }

  return {
    drivers: buildTable([...rows.values()]),
    teams: [...teamRows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins),
    roundsDone: history.length,
    roundsTotal: roundsFor(series).length,
  };
}

/** Puesto del jugador en la clasificación de pilotos. */
function playerRow(standings, driverId) {
  const idx = standings.drivers.findIndex((d) => d.driverId === driverId);
  return idx < 0 ? null : { ...standings.drivers[idx], position: idx + 1 };
}

function teamRow(standings, teamId) {
  const idx = standings.teams.findIndex((t) => t.teamId === teamId);
  return idx < 0 ? null : { ...standings.teams[idx], position: idx + 1 };
}

/* ─────────────── Clasificación de una sesión deFP / quali ─────────────── */

/**
 * Ordena una sesión de clasificación por mejor vuelta.
 * @param {Array} rows objetos {driverId, bestLapMs, ...}
 * @param {(a,b)=>number} tiebreaker
 */
function sortQualifying(rows, tiebreaker = (a, b) => a.bestLapMs - b.bestLapMs) {
  return rows.slice().sort(tiebreaker);
}

/** Reparte los puestos de una Q1 (se eliminan los últimos). */
function eliminateQ1(order, advance) {
  const idx = order.findIndex((r) => r.driverId === '__none__');
  const out = order.slice(0, advance);
  return { advancing: out, eliminated: order.slice(advance) };
}

/* ─────────────── Resumen de fin de semana para la UI ─────────────── */

function weekendSummary(round, history) {
  const entry = history.find((h) => h.round === round.round);
  if (!entry) return null;
  const quali = entry.results.find((r) => r.kind === 'quali');
  const main = entry.results.find((r) => r.kind === 'feature');
  return {
    quali: quali ? quali.entries : [],
    main: main ? main.entries : [],
    bestQ: quali && quali.entries[0],
    winner: main && main.entries[0],
  };
}

function pointsString(points) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

  __x.pointsForPosition = pointsForPosition;
  __x.scoreSession = scoreSession;
  __x.gridString = gridString;
  __x.buildStandings = buildStandings;
  __x.playerRow = playerRow;
  __x.teamRow = teamRow;
  __x.sortQualifying = sortQualifying;
  __x.eliminateQ1 = eliminateQ1;
  __x.weekendSummary = weekendSummary;
  __x.pointsString = pointsString;
};
__registry["js/game/track.js"] = function (__x, __req) {
// Construcción de circuitos a partir de un trazado compacto de segmentos.
// Genera línea central, anchura, pianos, boxes, zonas DRS, sectores y línea de carrera.

const { clamp, dist, TAU, mod } = __req("js/core/util.js");

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
function recordSeconds(record) {
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
function buildTrack(def) {
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
function speedProfile(track, gripFactor = 1) {
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

function idealLapTime(track, gripFactor = 1) {
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

function indexAtS(track, s) {
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

function pointAtS(track, s) {
  return track.points[indexAtS(track, s)];
}

/** Proyecta el coche sobre la pista: índice, avance, distancia lateral. */
function projectCar(track, x, y, hint = 0) {
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

function inDrsZone(track, idx) {
  for (const z of track.drsZones) {
    if (z.to > z.from) {
      if (idx >= z.from && idx <= z.to) return z;
    } else if (idx >= z.from || idx <= z.to) return z;
  }
  return null;
}

function sectorAt(track, s) {
  if (s < track.sectors[0]) return 1;
  if (s < track.sectors[1]) return 2;
  return 3;
}

function nearestPitDistance(track, x, y) {
  let best = Infinity;
  const path = track.pit.path;
  for (let i = 0; i < path.length; i++) {
    const d = dist(x, y, path[i].x, path[i].y);
    if (d < best) best = d;
  }
  return best;
}

function inPitLane(track, x, y) {
  return nearestPitDistance(track, x, y) < track.pit.halfWidth + 1.2;
}

/**
 * Minimapa en un viewBox de 0 0 100 100. Devuelve la traza ya proyectada y las
 * piezas (línea de meta, boxes) listas para dibujar.
 */
function minimap(track, step = 2) {
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

  __x.recordSeconds = recordSeconds;
  __x.buildTrack = buildTrack;
  __x.speedProfile = speedProfile;
  __x.idealLapTime = idealLapTime;
  __x.indexAtS = indexAtS;
  __x.pointAtS = pointAtS;
  __x.projectCar = projectCar;
  __x.inDrsZone = inDrsZone;
  __x.sectorAt = sectorAt;
  __x.nearestPitDistance = nearestPitDistance;
  __x.inPitLane = inPitLane;
  __x.minimap = minimap;
};
__registry["js/main.js"] = function (__x, __req) {
// Punto de entrada: pantalla de carga, menú principal y arranque de la aplicación.
// Todo se monta dentro de init() para que el módulo pueda importarse sin DOM.

const { $, el } = __req("js/ui/dom.js");
const { Shell } = __req("js/ui/shell.js");
const { ctx, setSettings } = __req("js/ui/context.js");
const { MenuBackground } = __req("js/render/menu-bg.js");
const { audio, audioBoot } = __req("js/core/audio.js");
const { listSlots, lastSlotIndex, readSlot, SLOT_COUNT } = __req("js/core/storage.js");
const { TIPS } = __req("js/ui/tips.js");

let shell = null;
let menuBg = null;
let dom = null;

const BOOT_STEPS = [
  ['Iniciando motores', () => { audioBoot(); }],
  ['Cargando circuitos', async () => { const m = await __lazy("js/data/circuits.js"); ctx.circuitCount = m.circuitCount(); }],
  ['Cargando calendario', async () => { await __lazy("js/data/calendar.js"); }],
  ['Cargando pilotos', async () => { await __lazy("js/data/drivers.js"); }],
  ['Cargando escuderías', async () => { await __lazy("js/data/teams.js"); }],
  ['Preparando la física', async () => { await __lazy("js/game/car.js"); }],
  ['Afinando el motor de carrera', async () => { await __lazy("js/game/race.js"); }],
  ['Montando la interfaz', () => { setupShell(); }],
  ['Listo', () => { finishBoot(); }],
];

/* ─────────────────────────── Arranque ─────────────────────────── */

async function runBoot() {
  dom.boot.tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  for (let i = 0; i < BOOT_STEPS.length; i++) {
    const [label, run] = BOOT_STEPS[i];
    dom.boot.status.textContent = label;
    const pct = Math.round(((i + 1) / BOOT_STEPS.length) * 100);
    dom.boot.pct.textContent = `${pct}%`;
    dom.boot.fill.style.width = `${pct}%`;
    await new Promise((r) => setTimeout(r, 90 + Math.random() * 130));
    try {
      await run();
    } catch (err) {
      console.error(`Fallo en «${label}»`, err);
    }
  }
}

function finishBoot() {
  dom.boot.root.style.transition = 'opacity .45s ease';
  dom.boot.root.style.opacity = '0';
  setTimeout(() => {
    dom.boot.root.hidden = true;
    showMenu();
    /* Avisa al vigilante del index.html de que todo ha ido bien. */
    window.dispatchEvent(new CustomEvent('predestinato:ready'));
  }, 460);
}

/* ─────────────────────────── Menú ─────────────────────────── */

function showMenu() {
  dom.menu.root.hidden = false;
  dom.app.root.hidden = true;
  menuBg?.start();
  refreshMenuCards();
  renderMenuSide();
}

function hideMenu() {
  dom.menu.root.hidden = true;
  menuBg?.stop();
  dom.app.root.hidden = false;
}

function refreshMenuCards() {
  const withData = listSlots().filter((s) => !s.empty);
  const last = withData.find((s) => s.index === lastSlotIndex()) || withData[0] || null;
  const btn = dom.menu.continueBtn;
  if (last) {
    const meta = last.meta || {};
    btn.disabled = false;
    dom.menu.continueTitle.textContent = `Continuar · ${meta.driverName || 'Piloto'}`;
    dom.menu.continueDesc.textContent = `${meta.series === 'f1' ? 'F1' : 'F2'} · ${meta.teamName || 'sin equipo'} · ronda ${meta.round ?? '—'} · ${meta.points ?? 0} pts`;
    btn.onclick = () => startCareer(last.index);
  } else {
    btn.disabled = true;
    dom.menu.continueTitle.textContent = 'Modo Carrera';
    dom.menu.continueDesc.textContent = 'No hay ninguna carrera guardada en este dispositivo.';
    btn.onclick = null;
  }
  dom.menu.soundBtn.textContent = ctx.settings.sound ? 'Sonido ON' : 'Sonido OFF';
  dom.menu.soundBtn.setAttribute('aria-pressed', String(Boolean(ctx.settings.sound)));
  const total = withData.length;
  dom.menu.foot.textContent = total
    ? `${total} de ${SLOT_COUNT} huecos en uso. Todo ocurre en tu dispositivo, sin cuentas ni nube.`
    : 'Todo ocurre en tu dispositivo. Sin anuncios, sin registro, sin instalaciones.';
}

function renderMenuSide() {
  const slots = listSlots();
  dom.menu.side.textContent = '';
  dom.menu.side.append(
    el('div.info-card', null, [
      el('h3', { text: 'Temporada 2026' }),
      el('div.big', { text: '23 + 14' }),
      el('div.hint', { text: 'Grandes premios de F1 y citas de F2, con seis fines de semana de Sprint en F1.' }),
    ]),
    el('div.info-card', null, [
      el('h3', { text: 'Modo Carrera' }),
      el('ul', null, [
        el('li', { text: 'Empiezas en F2 con un equipo a elegir.' }),
        el('li', { text: 'Clasifícate en el podio final para subir a F1.' }),
        el('li', { text: 'Garaje, buzón y objetivos entre semana.' }),
      ]),
    ]),
    el('div.info-card', null, [
      el('h3', { text: 'Partidas' }),
      el('div.row.between', null, [
        el('span.muted', { text: 'Huecos usados' }),
        el('b.mono', { text: `${slots.filter((s) => !s.empty).length}/${SLOT_COUNT}` }),
      ]),
    ]),
  );
}

/* ─────────────────────────── Aplicación ─────────────────────────── */

const NAV_ITEMS = [
  { id: 'paddock', label: 'Paddock' },
  { id: 'calendar', label: 'Calendario' },
  { id: 'standings', label: 'Mundial' },
  { id: 'inbox', label: 'Buzón' },
  { id: 'garage', label: 'Garaje' },
];

function setupShell() {
  shell = new Shell({
    appbar: $('#appbar'),
    body: $('#app-body'),
    toasts: $('#toasts'),
    modalRoot: $('#modal-root'),
  });
  ctx.shell = shell;
  shell.setNav(NAV_ITEMS);
  shell.onNavigate = (id) => navigate(id);
}

async function navigate(id) {
  if (ctx.running || !ctx.career) return;
  shell.setNav(NAV_ITEMS);
  shell.setActive(id);
  const screens = {
    paddock: () => __lazy("js/ui/screens/paddock.js").then((m) => m.showPaddock(shell, {})),
    calendar: () => __lazy("js/ui/screens/calendar.js").then((m) => m.showCalendar(shell)),
    standings: () => __lazy("js/ui/screens/standings.js").then((m) => m.showStandings(shell)),
    inbox: () => __lazy("js/ui/screens/inbox.js").then((m) => m.showInbox(shell, {})),
    garage: () => __lazy("js/ui/screens/garage.js").then((m) => m.showGarage(shell)),
  };
  await screens[id]?.();
}

/** Entra en la aplicación con la partida del hueco indicado. */
async function startCareer(slotIndex) {
  const data = readSlot(slotIndex);
  if (!data) {
    refreshMenuCards();
    return;
  }
  const { hydrateState } = await __lazy("js/game/career.js");
  ctx.career = hydrateState(data.state);
  ctx.slot = slotIndex;
  hideMenu();
  navigate('paddock');
  audio.startMusic('menu');
}

/** Arranca una carrera nueva desde la pantalla de creación de piloto. */
async function startNewCareer() {
  const { driverCreateScreen } = await __lazy("js/ui/screens/driver-create.js");
  const free = listSlots().find((s) => s.empty);
  ctx.slot = free ? free.index : 0;
  ctx.career = null;
  hideMenu();
  shell.stack.length = 0;
  shell.current = driverCreateScreen;
  await driverCreateScreen.render(shell, {});
  shell.setChrome({ title: driverCreateScreen.title, subtitle: driverCreateScreen.subtitle });
}

async function openOverlay(loader, extra = {}) {
  const mod = await loader();
  hideMenu();
  dom.app.root.hidden = false;
  await mod(shell, {
    ...extra,
    onBack: () => {
      dom.app.root.hidden = true;
      showMenu();
    },
  });
}

/* ─────────────────────────── Ciclo de vida ─────────────────────────── */

function wireMenu() {
  dom.menu.newBtn.addEventListener('click', startNewCareer);
  dom.menu.savesBtn.addEventListener('click', () => openOverlay(() => __lazy("js/ui/screens/saves.js").then((m) => m.showSaves), {
    onPick: () => {
      dom.app.root.hidden = true;
      startCareer(ctx.slot);
    },
  }));
  dom.menu.howBtn.addEventListener('click', () => openOverlay(() => __lazy("js/ui/screens/howto.js").then((m) => m.showHowTo)));
  dom.menu.settingsBtn.addEventListener('click', () => openOverlay(() => __lazy("js/ui/screens/settings.js").then((m) => m.showSettings)));
  dom.menu.soundBtn.addEventListener('click', () => {
    const on = !ctx.settings.sound;
    setSettings({ sound: on });
    audio.setEnabled(on);
    refreshMenuCards();
    audio.sfx('click');
  });
}

function wireLifecycle() {
  window.addEventListener('resize', () => menuBg?.resize());
  window.addEventListener('beforeunload', () => {
    if (ctx.career && ctx.slot !== null) {
      __lazy("js/ui/save.js").then((m) => m.persist()).catch(() => {});
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.stopLoops();
    else if (!ctx.running) audio.startMusic('menu');
  });
}

function init() {
  try {
    dom = {
      boot: {
        root: $('#boot'), fill: $('#boot-fill'), status: $('#boot-status'),
        pct: $('#boot-pct'), tip: $('#boot-tip'),
      },
      menu: {
        root: $('#menu'), side: $('#menu-side'),
        continueBtn: $('#mc-continue'), continueTitle: $('#mc-continue-title'), continueDesc: $('#mc-continue-desc'),
        newBtn: $('#mc-new'), savesBtn: $('#mc-saves'), howBtn: $('#mc-how'),
        soundBtn: $('#menu-sound'), settingsBtn: $('#menu-settings'), foot: $('#menu-foot-text'),
      },
      app: { root: $('#app') },
    };
    const missing = Object.entries(dom)
      .flatMap(([, part]) => Object.entries(part))
      .filter(([, node]) => !node)
      .map(([key]) => key);
    if (missing.length) throw new Error(`faltan elementos en index.html: ${missing.join(', ')}`);
    menuBg = new MenuBackground($('#menu-canvas'));
    wireMenu();
    wireLifecycle();
    runBoot();
  } catch (err) {
    console.error('No se pudo iniciar', err);
    const status = document.getElementById('boot-status');
    const tip = document.getElementById('boot-tip');
    if (status) status.textContent = 'No se pudo iniciar el juego';
    if (tip) {
      tip.textContent = `Error: ${err.message}`;
      tip.style.color = '#ff6b81';
      tip.style.whiteSpace = 'pre-wrap';
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}


};
__registry["js/render/hud.js"] = function (__x, __req) {
// HUD de carrera: se construye con DOM (texto nítido y accesible) y se
// sincroniza con el estado de sesión en cada fotograma.

const { el, formatTime, formatGap } = __req("js/ui/dom.js");
const { Minimap } = __req("js/render/minimap.js");
const { TYRE_STYLE } = __req("js/render/palette.js");
const { TYRES } = __req("js/game/car.js");
const { clamp } = __req("js/core/util.js");

const SECTOR_LABELS = ['S1', 'S2', 'S3'];

class Hud {
  constructor(root) {
    this.root = root;
    this.minimapVisible = true;
    this.units = 'metric';
    this.bestSectors = [Infinity, Infinity, Infinity];
    this.build();
  }

  build() {
    this.root.className = 'hud';
    this.root.textContent = '';

    this.posBox = el('div.hud-box', null, [
      el('div.hud-pos', null, [el('b', { text: '—' }), el('span', { text: '/—' })]),
      el('div.hud-laps', null, [el('b', { text: 'V1' }), ' vuelta']),
    ]);
    this.posValue = this.posBox.querySelector('.hud-pos b');
    this.posTotal = this.posBox.querySelector('.hud-pos span');
    this.lapValue = this.posBox.querySelector('.hud-laps b');

    const row = (label, ...values) => [el('i', { text: label }), ...values];
    this.timing = el('div.hud-box.hud-times', null, [
      ...row('Vuelta', ...Array.from({ length: 3 }, () => el('b', { text: '—' }))),
      ...row('Sectores', ...Array.from({ length: 3 }, () => el('b', { text: '—' }))),
      ...row('Intervalo', el('b', { text: '—', style: { gridColumn: 'span 3' } })),
    ]);
    const cells = [...this.timing.querySelectorAll('b')];
    this.cellActual = cells[0];
    this.cellLast = cells[1];
    this.cellBest = cells[2];
    this.cellSectors = cells.slice(3, 6);
    this.cellGap = cells[6];

    this.standings = el('div.hud-box.hud-standings');
    this.speedBox = el('div.hud-box', null, [el('div.hud-speed', null, [el('b', { text: '0' }), el('span', { text: 'km/h' })])]);
    this.speedValue = this.speedBox.querySelector('b');
    this.speedUnit = this.speedBox.querySelector('span');
    this.gearBox = el('div.hud-gear', { text: 'N' });

    this.tyreRow = el('div.hud-box', null, [
      el('div.hud-tyre', null, Array.from({ length: 4 }, () => el('i'))),
      el('div.hud-tyre-label', { text: 'C3' }),
      el('div.hud-ers', null, el('i')),
      el('div.hud-drs', { text: 'DRS' }),
    ]);
    this.tyreCells = [...this.tyreRow.querySelectorAll('.hud-tyre i')];
    this.tyreLabel = this.tyreRow.querySelector('.hud-tyre-label');
    this.ersBar = this.tyreRow.querySelector('.hud-ers i');
    this.drsLabel = this.tyreRow.querySelector('.hud-drs');

    this.messages = el('div.hud-box.hud-msg', { text: '' });
    this.pit = el('div.hud-pit', { text: '' });
    this.pit.style.display = 'none';
    this.lights = el('div.hud-lights', null, Array.from({ length: 5 }, () => el('i')));
    this.banner = el('div.hud-banner', { text: '' });
    this.banner.style.display = 'none';

    this.mapCanvas = el('canvas.minimap', { width: 172, height: 172, 'aria-hidden': 'true' });
    this.mapCanvas.style.width = '172px';
    this.mapCanvas.style.height = '172px';

    this.root.append(
      el('div.hud-tl', null, [this.posBox, this.timing, this.pit]),
      el('div.hud-tr', null, [this.messages]),
      el('div.hud-bl', null, [this.speedBox, this.gearBox, this.tyreRow]),
      el('div.hud-br', null, [this.standings, this.mapCanvas]),
      el('div.hud-bc', null, [this.banner, this.lights]),
    );
    this.minimap = new Minimap(this.mapCanvas);
  }

  setTrack(track) {
    this.minimap.setTrack(track);
    this.bestSectors = [Infinity, Infinity, Infinity];
  }

  setMinimapVisible(on) {
    this.minimapVisible = Boolean(on);
    this.mapCanvas.hidden = !this.minimapVisible;
    /* Al volver a mostrarse hay que recalcular el tamaño del lienzo. */
    if (this.minimapVisible) this.minimap.layout();
  }

  setUnits(units) {
    this.units = units === 'imperial' ? 'imperial' : 'metric';
  }

  /** Reinicia los mejores valores al cambiar de sesión. */
  reset() {
    this.bestSectors = [Infinity, Infinity, Infinity];
  }

  /** Sincroniza el HUD con el estado de la sesión. */
  update(state) {
    const p = state.player;
    if (!p) return;

    const total = state.entries?.length || 0;
    this.posValue.textContent = p.retired ? '—' : (p.position || 0);
    this.posTotal.textContent = `/${total}`;
    this.lapValue.textContent = p.retired ? '—' : `V${Math.max(1, p.lap || 1)}`;

    const running = state.phase === 'running' || state.phase === 'green';
    this.cellActual.textContent = running ? formatTime(p.lapMs) : '—';
    this.cellLast.textContent = formatTime(p.lastLapMs);
    this.cellBest.textContent = formatTime(p.bestLapMs);
    this.cellGap.textContent = p.retired ? '—' : formatGap(p.intervalMs ?? null);
    this.paintSectors(p);

    const factor = this.units === 'imperial' ? 2.23694 : 3.6;
    this.speedUnit.textContent = this.units === 'imperial' ? 'mph' : 'km/h';
    this.speedValue.textContent = Math.round((p.speed || 0) * factor);
    this.gearBox.textContent = p.retired ? '—' : (p.speed < 1 ? 'N' : String(p.gear || 1));
    this.gearBox.style.borderColor = p.drsOpen ? '#22c55e' : '';

    this.updateTyres(p);
    this.ersBar.style.width = `${Math.round((p.ers || 0) * 100)}%`;
    this.drsLabel.classList.toggle('on', Boolean(p.drsOpen));
    this.drsLabel.textContent = p.drsOpen ? 'DRS' : p.drsZone ? 'DRS?' : 'DRS';

    this.updateStandings(state);
    this.updateBanner(state);
    this.updateLights(state);
    this.updatePit(state);
    this.updateMessages(state);

    if (this.minimapVisible) this.minimap.draw(state);
  }

  /** Colorea los cronos de sector según el mejor personal de la sesión. */
  paintSectors(p) {
    for (let i = 0; i < 3; i++) {
      const ms = p.sectorTimes?.[i];
      const cell = this.cellSectors[i];
      if (!Number.isFinite(ms) || ms <= 0) {
        cell.textContent = '—';
        cell.style.color = '';
        continue;
      }
      cell.textContent = `${SECTOR_LABELS[i]} ${formatTime(ms)}`;
      if (ms < this.bestSectors[i]) {
        this.bestSectors[i] = ms;
        cell.style.color = '#4ade80';
      } else {
        cell.style.color = ms < this.bestSectors[i] * 1.02 ? '#e2e8f0' : '#facc15';
      }
    }
  }

  updateTyres(p) {
    const style = TYRE_STYLE[p.tyre] || TYRE_STYLE.medium;
    const t = TYRES[p.tyre] || TYRES.medium;
    const life = Math.max(1, t.life);
    const used = clamp((p.tyreWear || 0) * life, 0, life);
    const wear = used >= life - 1 ? 2 : used >= life * 0.55 ? 1 : 0;
    for (const cell of this.tyreCells) {
      cell.className = wear > 0 ? `wear-${wear}` : '';
      cell.style.background = wear > 0 ? '' : style.color;
    }
    this.tyreLabel.textContent = `${style.label} · ${Math.max(0, life - used).toFixed(1)}v`;
  }

  updateStandings(state) {
    const order = state.order || [];
    const me = state.player;
    const live = order.filter((c) => !c.retired);
    const shown = live.slice(0, 5);
    if (me && !me.retired && live.indexOf(me) >= 5) shown.push(me);
    this.standings.textContent = '';
    for (const car of shown) {
      if (!car || car.retired) continue;
      const pos = car.position || live.indexOf(car) + 1;
      const gap = pos === 1 ? null : car.gaps?.ahead ?? null;
      this.standings.append(el('div.r', { class: car.isPlayer ? 'me' : '' }, [
        el('span.p', { text: String(pos) }),
        el('span', { text: car.short || String(car.name || '').split(' ').pop() }),
        el('span.g', { text: pos === 1 ? 'Líder' : formatGap(gap) }),
      ]));
    }
  }

  updateBanner(state) {
    let text = '';
    let kind = '';
    if (state.safetyCar?.active) {
      text = `CARRERA DE SEGURIDAD ${Math.max(0, state.safetyCar.remaining || 0).toFixed(0)}s`;
      kind = 'sc';
    } else if (state.flags?.sc) {
      text = 'SALIDA NEUTRALIZADA';
      kind = 'yellow';
    } else if (state.flags?.yellow) {
      text = `BANDERA AMARILLA ${Math.max(0, state.flags.yellow).toFixed(0)}s`;
      kind = 'yellow';
    } else if (state.flags?.green) {
      text = 'PISTA LIBRE';
      kind = 'green';
    } else if (state.player?.finished) {
      text = `BANDEERA A CUADROS · P${state.player.position}`;
      kind = 'finish';
    }
    this.banner.textContent = text;
    this.banner.style.display = text ? '' : 'none';
    this.banner.className = `hud-banner ${kind}`;
  }

  /** Aviso de la parada obligatoria: queda o hecha, con la tecla P. */
  updatePit(state) {
    const p = state.player;
    if (!this.pit) return;
    const isRace = state.kind === 'feature' || state.kind === 'sprint';
    if (!isRace || !p || p.retired || p.finished) {
      this.pit.style.display = 'none';
      return;
    }
    const done = p.pitStops >= (state.maxStops || 1);
    this.pit.style.display = '';
    this.pit.className = `hud-pit${done ? ' ok' : p.pitAdvice === 'late' || p.pitAdvice === 'now' ? ' warn' : ''}`;
    this.pit.textContent = done
      ? `Parada hecha (v${p.pitLap})`
      : `Parada obligatoria · P · Quedan ${Math.max(0, state.laps - p.lap)} vueltas`;
  }

  updateLights(state) {
    const counting = state.phase === 'countdown';
    const justGreen = state.phase === 'green' && state.greenTimer > 0;
    if (!counting && !justGreen) {
      this.lights.style.display = 'none';
      return;
    }
    this.lights.style.display = '';
    const lit = counting ? state.lights || 0 : 0;
    this.lights.classList.toggle('out', !counting);
    [...this.lights.children].forEach((cell, i) => cell.classList.toggle('on', i < lit));
    this.lights.dataset.text = counting ? 'SALIDA' : '¡YA!';
  }

  updateMessages(state) {
    const list = state.messages || [];
    const last = list[list.length - 1];
    this.messages.textContent = last ? last.text : '';
  }

  destroy() {
    this.root.textContent = '';
  }
}

  __x.Hud = Hud;
};
__registry["js/render/menu-bg.js"] = function (__x, __req) {
// Fondo animado del menú: trazo de circuito difuminado, líneas de velocidad
// y partículas. Usa requestAnimationFrame y se detiene al ocultar el menú.

class MenuBackground {
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

  __x.MenuBackground = MenuBackground;
};
__registry["js/render/minimap.js"] = function (__x, __req) {
// Minimap: reutiliza el trazado SVG que genera track.js y añade los coches.

class Minimap {
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
function parsePath(d) {
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

  __x.Minimap = Minimap;
  __x.parsePath = parsePath;
};
__registry["js/render/palette.js"] = function (__x, __req) {
// Paleta y helpers de color compartidos por los renderizadores.

const INK = '#05060a';
const ASPHALT = '#262a33';
const ASPHALT_DARK = '#1b1e25';
const KERB_RED = '#c8382f';
const KERB_BLUE = '#2f5cc8';
const GRASS = '#16281a';
const GRASS_ALT = '#1a3020';
const CARBON = '#15171d';
const WHITE = '#f2f4f8';

const TYRE_STYLE = {
  soft: { color: '#e8112d', label: 'C5' },
  medium: { color: '#f5d000', label: 'C3' },
  hard: { color: '#e6e8ee', label: 'C2' },
};

const TYRE_ORDER = ['soft', 'medium', 'hard'];

/** Convierte «#rrggbb» en «r, g, b» para usar con rgba(). */
function rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function alpha(hex, a) {
  return `rgba(${rgb(hex)}, ${a})`;
}

/** Color de equipo con respaldo neutro. */
function teamColor(team) {
  return team?.livery?.primary || '#9aa3b5';
}

function teamSecondary(team) {
  return team?.livery?.secondary || '#1a1e28';
}

  /** Aclara u oscurece un color hexadecimal (amount de -1 a 1). */
function shade(hex, amount) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const mix = (channel) => {
    const target = amount < 0 ? 0 : 255;
    return Math.round(channel + (target - channel) * Math.abs(amount));
  };
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Contraste legible sobre un color de fondo. */
function readableOn(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.58 ? '#101318' : '#ffffff';
}

  __x.INK = INK;
  __x.ASPHALT = ASPHALT;
  __x.ASPHALT_DARK = ASPHALT_DARK;
  __x.KERB_RED = KERB_RED;
  __x.KERB_BLUE = KERB_BLUE;
  __x.GRASS = GRASS;
  __x.GRASS_ALT = GRASS_ALT;
  __x.CARBON = CARBON;
  __x.WHITE = WHITE;
  __x.TYRE_STYLE = TYRE_STYLE;
  __x.TYRE_ORDER = TYRE_ORDER;
  __x.rgb = rgb;
  __x.alpha = alpha;
  __x.teamColor = teamColor;
  __x.teamSecondary = teamSecondary;
  __x.shade = shade;
  __x.readableOn = readableOn;
};
__registry["js/render/track-view.js"] = function (__x, __req) {
// Renderizador de la vista superior del circuito: asfalto, pianos, línea de meta,
// zona de DRS, boxes y coches. Trabaja en coordenadas del circuito y se
// transforma al lienzo con una cámara que sigue al jugador.

const { ASPHALT, ASPHALT_DARK, CARBON, GRASS, KERB_BLUE, KERB_RED, WHITE, alpha, readableOn, teamColor, teamSecondary } = __req("js/render/palette.js");

const CAMERAS = {
  1: { zoom: 3.6, name: 'Cockpit' },
  2: { zoom: 2.4, name: 'Cámara alta' },
  3: { zoom: 1.15, name: 'Cenital' },
  4: { zoom: 0, name: 'Completa' },
};

class TrackView {
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

  __x.TrackView = TrackView;
};
__registry["js/ui/context.js"] = function (__x, __req) {
// Estado global de la aplicación. Las pantallas leen y escriben aquí para
// evitar imports circulares entre main.js y las pantallas.

const { loadSettings, saveSettings } = __req("js/core/storage.js");
const { currentRound, calendarFor, isSeasonOver, pendingSession } = __req("js/game/career.js");
const { getTeam } = __req("js/data/teams.js");

const ctx = {
  career: null,
  slot: null,
  settings: loadSettings(),
  session: null,
  view: null,
  hud: null,
  shell: null,
  running: false,
  lastResult: null,
  teamsById: {},
};

function setSettings(patch) {
  ctx.settings = { ...ctx.settings, ...patch };
  saveSettings(ctx.settings);
  return ctx.settings;
}

function resetSettings() {
  return setSettings({});
}

/** Índice de la serie activa. */
function series(state = ctx.career) {
  return state?.series || 'f2';
}

function isF1(state = ctx.career) {
  return series(state) === 'f1';
}

function currentRoundDef(state = ctx.career) {
  return currentRound(state);
}

function calendar(state = ctx.career) {
  return calendarFor(state);
}

function seasonOver(state = ctx.career) {
  return isSeasonOver(state);
}

function pending(state = ctx.career) {
  return pendingSession(state);
}

function teamOf(id, serie = series()) {
  return getTeam(id, serie);
}

/** Índice de equipos por id, para el render de coches. */
function buildTeamIndex(serie = series()) {
  const index = {};
  for (const state of [ctx.career]) {
    if (!state) continue;
    for (const entry of state.entryList || []) {
      if (entry.teamId) index[entry.teamId] = getTeam(entry.teamId, state.series || serie);
    }
  }
  if (ctx.session) {
    for (const entry of ctx.session.entries || []) {
      if (entry.teamId) index[entry.teamId] = getTeam(entry.teamId, ctx.session.series || serie);
    }
  }
  ctx.teamsById = index;
  return index;
}

/** Próxima sesión jugable de la ronda activa. */
function nextSession(state = ctx.career) {
  const round = currentRound(state);
  if (!round) return null;
  return round.sessions.find((s) => s.required && !s.played) || null;
}

/** ¿Se puede correr la sesión indicada? */
function canRun(session, round, state = ctx.career) {
  if (!session || session.played) return false;
  if (!session.required) return true;
  const order = round.sessions.filter((s) => s.required);
  const index = order.indexOf(session);
  if (index <= 0) return true;
  return order.slice(0, index).every((s) => s.played);
}

  __x.ctx = ctx;
  __x.setSettings = setSettings;
  __x.resetSettings = resetSettings;
  __x.series = series;
  __x.isF1 = isF1;
  __x.currentRoundDef = currentRoundDef;
  __x.calendar = calendar;
  __x.seasonOver = seasonOver;
  __x.pending = pending;
  __x.teamOf = teamOf;
  __x.buildTeamIndex = buildTeamIndex;
  __x.nextSession = nextSession;
  __x.canRun = canRun;
};
__registry["js/ui/dom.js"] = function (__x, __req) {
// Utilidades de DOM para construir la interfaz sin framework.
// Todo el HTML se genera con estas funciones: createElement, html y on.

/**
 * Crea un elemento con atributos, estilos, hijos y escuchas.
 * @param {string} tag etiqueta, admite selectores simples ('div.clase#id')
 * @param {object|null} props atributos; `class`, `text`, `html`, `style` (objeto),
 *   `dataset` (objeto) y `on` (objeto de escuchas)
 * @param {Array|string|Node} [children]
 */
function el(tag, props = null, children = null) {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const node = document.createElement(name || 'div');
  for (const token of rest) {
    if (token[0] === '.') node.classList.add(token.slice(1));
    else if (token[0] === '#') node.id = token.slice(1);
  }
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = `${node.className} ${value}`.trim();
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
      else if (key in node && key !== 'list' && typeof value !== 'object') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
  }
  append(node, children);
  return node;
}

function append(parent, children) {
  if (children === null || children === undefined || children === false) return parent;
  if (Array.isArray(children)) {
    for (const child of children) append(parent, child);
    return parent;
  }
  parent.append(children instanceof Node ? children : document.createTextNode(String(children)));
  return parent;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Botón con aspecto uniforme. */
function button(label, opts = {}) {
  const { kind = '', onClick, disabled, title, small, large, pressed, icon } = opts;
  const size = small ? '.btn-sm' : large ? '.btn-lg' : '';
  return el(`button.btn${kind ? `.btn-${kind}` : ''}${size}`, {
    type: 'button',
    title: title || label,
    disabled: Boolean(disabled),
    'aria-pressed': pressed === undefined ? null : String(Boolean(pressed)),
    on: onClick ? { click: onClick } : null,
  }, [icon ? el('span', { text: icon }) : null, label]);
}

/** Fila `clave → valor` para fichas de datos. */
function kv(pairs) {
  const list = el('dl.kv');
  for (const [key, value] of pairs) {
    if (value === undefined) continue;
    list.append(el('dt', { text: key }), el('dd', null, value));
  }
  return list;
}

/** Barra de progreso con etiqueta. */
function bar(value, max = 100, kind = '') {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return el(`div.bar-track${kind ? `.${kind}` : ''}`, null, el('i', { style: { width: `${pct}%` } }));
}

/** Grupo de botones excluyentes. */
function segmented(options, current, onPick) {
  const wrap = el('div.segmented');
  for (const opt of options) {
    const value = typeof opt === 'string' ? opt : opt.value;
    const label = typeof opt === 'string' ? opt : opt.label;
    wrap.append(el('button', {
      type: 'button',
      text: label,
      'aria-pressed': String(value === current),
      on: { click: () => onPick(value) },
    }));
  }
  return wrap;
}

/** Interruptor con descripción. */
function toggle(label, desc, value, onChange) {
  const btn = el('button', {
    type: 'button',
    'aria-pressed': String(Boolean(value)),
    'aria-label': label,
    on: { click: () => onChange(btn.getAttribute('aria-pressed') !== 'true') },
  });
  const row = el('div.switch', null, [
    el('div', null, [el('div', { text: label }), desc ? el('div.desc', { text: desc }) : null]),
    btn,
  ]);
  row.sync = (next) => btn.setAttribute('aria-pressed', String(Boolean(next)));
  return row;
}

/** Formatea segundos como m:ss.mmm o s.mmm. */
function formatTime(ms, { sign = false } = {}) {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return '—';
  const total = Math.abs(ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  const body = m > 0
    ? `${m}:${s.toFixed(3).padStart(6, '0')}`
    : s.toFixed(3);
  if (!sign) return body;
  return `${ms < 0 ? '-' : '+'}${body}`;
}

/** Diferencia con signo para tablas de clasificación. */
function formatGap(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (Math.abs(ms) < 1) return '—';
  return formatTime(ms, { sign: true });
}

function formatKmh(mps, units = 'metric') {
  if (!Number.isFinite(mps)) return '—';
  return units === 'imperial' ? `${Math.round(mps * 2.23694)} mph` : `${Math.round(mps * 3.6)} km/h`;
}

/** Fecha ISO a «sáb 6 mar». */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

  __x.el = el;
  __x.append = append;
  __x.clear = clear;
  __x.$ = $;
  __x.$$ = $$;
  __x.button = button;
  __x.kv = kv;
  __x.bar = bar;
  __x.segmented = segmented;
  __x.toggle = toggle;
  __x.formatTime = formatTime;
  __x.formatGap = formatGap;
  __x.formatKmh = formatKmh;
  __x.formatDate = formatDate;
};
__registry["js/ui/save.js"] = function (__x, __req) {
// Guardado automático en el hueco activo. Se llama tras cada acción que
// modifica la carrera para que el progreso nunca se pierda.

const { writeSlot, lastSlotIndex, hasAnySave } = __req("js/core/storage.js");
const { playerRow, teamRow } = __req("js/game/standings.js");
const { driverCard, teamCard } = __req("js/game/career.js");
const { ctx } = __req("js/ui/context.js");

/** Escribe la carrera en localStorage. Devuelve true si se guardó. */
function persist() {
  const state = ctx.career;
  if (!state) return false;
  const slot = ctx.slot ?? lastSlotIndex() ?? 0;
  const card = driverCard(state);
  const crew = teamCard(state);
  const me = playerRow(state.standings || { drivers: [] }, state.driver.id);
  const team = teamRow(state.standings || { teams: [] }, state.teamId);
  const meta = {
    driverName: card.name,
    driverFlag: card.flag,
    driverNumber: card.number,
    teamName: crew.team.name,
    teamColor: crew.team.livery.primary,
    series: state.series,
    round: state.round,
    roundLabel: '',
    points: me?.points ?? 0,
    position: me?.position ?? null,
    teamPosition: team?.position ?? null,
    savedAt: new Date().toISOString(),
  };
  state.meta = meta;
  state.updatedAt = meta.savedAt;
  return writeSlot(slot, state, meta);
}

function autosave() {
  if (!ctx.career) return;
  try {
    persist();
  } catch {
    /* el guardado nunca debe romper la partida */
  }
}



  __x.hasAnySave = hasAnySave;
  __x.persist = persist;
  __x.autosave = autosave;
};
__registry["js/ui/screens/calendar.js"] = function (__x, __req) {
// Calendario completo de la temporada con el estado de cada ronda.

const { el } = __req("js/ui/dom.js");
const { calendarFor, currentRound, isSeasonOver } = __req("js/game/career.js");
const { formatDate } = __req("js/ui/dom.js");
const { ctx } = __req("js/ui/context.js");

async function showCalendar(shell) {
  const state = ctx.career;
  if (!state) return;
  const rounds = calendarFor(state);
  const current = currentRound(state);
  const resultsByRound = new Map(state.history.map((h) => [h.round, h]));
  const over = isSeasonOver(state);

  const rows = rounds.map((r) => {
    const entry = resultsByRound.get(r.round);
    const main = entry?.results?.find((x) => x.kind === 'feature');
    const me = main?.entries?.find((e) => e.driverId === state.driver.id);
    const isCurrent = current && r.round === current.round;
    const isPast = Boolean(entry) || r.round < (current?.round ?? 0);
    return el('tr', { class: isCurrent ? 'me' : '' }, [
      el('td.pos-cell', { text: String(r.round) }),
      el('td', null, el('div.driver-cell', null, [
        el('span.flag', { text: r.flag }),
        el('span.grow', { text: r.gp }),
        el('span.dim', { style: { fontSize: '11px' }, text: r.circuit.name }),
      ])),
      el('td', { class: 'dim', text: formatDate(r.days.sun) }),
      el('td', null, r.sprint || state.series === 'f2' ? el('span.chip', { text: 'Sprint' }) : el('span.dim', { text: '—' })),
      el('td.num', { text: me?.position ? `P${me.position}` : isPast ? '—' : '' }),
      el('td.num', { text: isCurrent ? '→' : isPast ? '✓' : '' }),
    ]);
  });

  const table = el('table.table', null, [
    el('thead', null, el('tr', null, [
      el('th', { text: '#' }),
      el('th', { text: 'Gran Premio' }),
      el('th', { text: 'Fecha' }),
      el('th', { text: 'Formato' }),
      el('th.num', { text: 'Tu resultado' }),
      el('th.num', { text: '' }),
    ])),
    el('tbody', null, rows),
  ]);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `Calendario ${state.series === 'f1' ? 'F1' : 'F2'} 2026` }),
        el('div.sub', { text: `${rounds.length} citas · ${rounds.filter((r) => r.sprint || state.series === 'f2').length} con Sprint` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip', { text: over ? 'Temporada cerrada' : `Ronda ${state.round}` }),
      ]),
    ]),
    el('div.card', null, [el('div.table-scroll', null, table)]),
  ]));

  shell.setChrome({ title: 'Calendario', subtitle: `${rounds.length} rondas` });
}

  __x.showCalendar = showCalendar;
};
__registry["js/ui/screens/driver-create.js"] = function (__x, __req) {
// Creación del piloto: perfil, casco, escudería y asiento en la parrilla de F2.

const { el, button, segmented } = __req("js/ui/dom.js");
const { COUNTRIES, HELMET_COLORS, HELMET_SKINS, validateBirth, MIN_AGE, MAX_AGE } = __req("js/data/countries.js");
const { teamsFor } = __req("js/data/teams.js");
const { driversFor } = __req("js/data/drivers.js");
const { createCareer } = __req("js/game/career.js");
const { averageRating } = __req("js/data/drivers.js");
const { ctx } = __req("js/ui/context.js");

const NAME_RE = /^[\p{L}][\p{L}' -]{2,28}$/u;

const driverCreateScreen = {
  id: 'driver-create',
  title: 'Nuevo piloto',
  subtitle: 'Tu carrera empieza en Fórmula 2',

  render(shell) {
    const form = {
      name: '',
      birthDate: '2004-03-14',
      country: 'ESP',
      helmetPrimary: '#e8112d',
      helmetSecondary: '#ffffff',
      helmetStyle: 'rayas',
      teamId: null,
      replaceDriverId: undefined,
    };

    const preview = el('div.card.accent');
    const errorBox = el('div.banner.danger', { text: '', style: { display: 'none' } });
    const nameErr = el('div.err');
    const birthErr = el('div.err');

    const nameInput = el('input', { type: 'text', maxLength: 29, placeholder: 'Nombre y apellidos', autocomplete: 'off' });
    const birthInput = el('input', {
      type: 'date',
      value: form.birthDate,
      min: `${2026 - MAX_AGE}-01-01`,
      max: `${2026 - MIN_AGE}-12-31`,
    });
    const countrySelect = el('select', null, COUNTRIES.map((c) => el('option', { value: c.code, text: `${c.flag} ${c.name}` })));
    countrySelect.value = form.country;

    const teamList = el('div.pick-list');
    const seatBox = el('div');
    const helmetPreview = el('div.helmet', { 'aria-hidden': 'true' });
    const styleBox = el('div.field');

    const showError = (text) => {
      errorBox.textContent = text;
      errorBox.style.display = '';
    };

    const renderPreview = () => {
      const name = form.name.trim() || 'Tu nombre';
      const birth = validateBirth(form.birthDate);
      const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
      helmetPreview.style.setProperty('--helmet-a', form.helmetPrimary);
      helmetPreview.style.setProperty('--helmet-b', form.helmetSecondary);
      helmetPreview.dataset.style = form.helmetStyle;
      preview.textContent = '';
      preview.append(
        el('div.row', { style: { alignItems: 'flex-start' } }, [
          helmetPreview,
          el('div.grow', null, [
            el('div', { style: { fontSize: '19px', fontWeight: '800' }, text: name }),
            el('div.dim', { style: { fontSize: '12px' }, text: `${initials} · ${form.country} · ${birth.ok ? `${birth.age} años` : 'fecha por confirmar'}` }),
            el('div.row.row-tight', { style: { marginTop: '6px' } }, [
              el('span.chip.chip-red', { text: 'F2 2026' }),
              el('span.chip', { text: form.helmetStyle }),
            ]),
          ]),
        ]),
      );
    };

    const renderSeats = () => {
      seatBox.textContent = '';
      if (!form.teamId) {
        seatBox.append(el('div.hint', { text: 'Elige una escudería para ver sus pilotos titulares.' }));
        return;
      }
      const roster = driversFor('f2').filter((d) => d.teamId === form.teamId);
      seatBox.append(
        el('div.hint', { text: 'Copiar el asiento de un titular te da su media de atributos, pero ese piloto sale de la lista.' }),
        el('div.pick-list', { style: { marginTop: '8px' } }, [
          seatOption(null, 'Asiento libre', 'Recurso joven sin referencia · base 72'),
          ...roster.map((d) => seatOption(d.id, `Sustituye a ${d.name}`, `Base ${Math.round(averageRating(d.ratings))} · ${d.traits?.[0] || 'piloto titular'}`)),
        ]),
      );
    };

    const seatOption = (id, title, desc) => el('button.pick', {
      type: 'button',
      'aria-pressed': String((form.replaceDriverId ?? null) === (id ?? null)),
      on: { click: () => { form.replaceDriverId = id ?? null; renderSeats(); } },
    }, [
      el('span.swatch-team', { style: { background: id ? '#2f3648' : 'var(--green)' } }),
      el('span.grow', null, [el('span.t', { text: title }), el('span.d', { text: desc })]),
    ]);

    const renderTeams = () => {
      const teams = teamsFor('f2').slice().sort((a, b) => (a.tier || 0) - (b.tier || 0));
      if (form.teamId && !teams.some((t) => t.id === form.teamId)) {
        form.teamId = null;
        form.replaceDriverId = undefined;
      }
      teamList.textContent = '';
      for (const team of teams) {
        teamList.append(el('button.pick', {
          type: 'button',
          'aria-pressed': String(form.teamId === team.id),
          on: {
            click: () => {
              form.teamId = team.id;
              form.replaceDriverId = undefined;
              renderTeams();
              renderSeats();
            },
          },
        }, [
          el('span.swatch-team', { style: { background: team.livery.primary } }),
          el('span.grow', null, [
            el('span.t', { text: team.name }),
            el('span.d', { text: `Potencia ${team.car.power} · Aerodinámica ${team.car.aero} · Fiabilidad ${team.car.reliability} · Presupuesto ${team.car.budget}` }),
          ]),
          el('span.chip', { text: team.tier === 1 ? 'Aspirante' : team.tier === 2 ? 'Media' : 'Modesta' }),
        ]));
      }
    };

    const swatchRow = (values, onPick) => {
      const row = el('div.swatches');
      for (const item of values) {
        row.append(el('button.swatch', {
          type: 'button',
          title: item.name,
          'aria-label': item.name,
          style: { background: `linear-gradient(140deg, ${item.primary} 0 55%, ${item.secondary} 55% 100%)` },
          on: { click: () => onPick(item) },
        }));
      }
      return row;
    };

    const renderStyles = () => {
      styleBox.textContent = '';
      styleBox.append(
        el('label', { text: 'Diseño' }),
        segmented(HELMET_SKINS.map((s) => ({ value: s.id, label: s.name })), form.helmetStyle, (value) => {
          form.helmetStyle = value;
          renderPreview();
        }),
      );
    };

    const start = async () => {
      const name = form.name.trim();
      if (!NAME_RE.test(name)) {
        nameErr.textContent = 'Entre 3 y 29 letras, sin números.';
        nameInput.classList.add('invalid');
        nameInput.focus();
        return;
      }
      nameErr.textContent = '';
      nameInput.classList.remove('invalid');
      const birth = validateBirth(form.birthDate);
      if (!birth.ok) {
        birthErr.textContent = birth.error;
        return;
      }
      birthErr.textContent = '';
      try {
        ctx.career = createCareer(form, {
          seed: `${name}|${form.birthDate}|${form.country}|${Date.now()}`,
          teamId: form.teamId || undefined,
          replaceDriverId: form.replaceDriverId,
        });
      } catch (err) {
        showError(err.message);
        return;
      }
      const { showPaddock } = await __lazy("js/ui/screens/paddock.js");
      shell.stack.length = 0;
      await showPaddock(shell, { fresh: true });
    };

    nameInput.addEventListener('input', () => { form.name = nameInput.value; renderPreview(); });
    birthInput.addEventListener('input', () => { form.birthDate = birthInput.value; renderPreview(); });
    countrySelect.addEventListener('change', () => { form.country = countrySelect.value; renderPreview(); });

    renderTeams();
    renderSeats();
    renderStyles();
    renderPreview();

    shell.mount(el('div.screen', null, [
      el('div.screen-head', null, [
        el('div', null, [
          el('h2', { text: 'Crea tu piloto' }),
          el('div.sub', { text: `Fórmula 2 2026. Debut en el Albert Park. Para correr en 2026 necesitas entre ${MIN_AGE} y ${MAX_AGE} años.` }),
        ]),
        button('Comenzar carrera', { kind: 'primary', large: true, onClick: start }),
      ]),
      errorBox,
      el('div.grid.grid-side', null, [
        el('div.stack', null, [
          el('div.card', null, [
            el('h3', { text: 'Perfil' }),
            el('div.grid.grid-2', null, [
              el('div.field', null, [el('label', { text: 'Nombre' }), nameInput, nameErr]),
              el('div.field', null, [el('label', { text: 'Fecha de nacimiento' }), birthInput, birthErr]),
            ]),
            el('div.field', { style: { marginTop: '10px' } }, [el('label', { text: 'Nacionalidad' }), countrySelect]),
          ]),
          el('div.card', null, [
            el('h3', { text: 'Casco' }),
            el('div.row', { style: { alignItems: 'flex-start' } }, [
              helmetPreview,
              el('div.grow.stack', null, [
                el('div.field', null, [
                  el('label', { text: 'Colores' }),
                  swatchRow(HELMET_COLORS, (item) => {
                    form.helmetPrimary = item.primary;
                    form.helmetSecondary = item.secondary;
                    renderPreview();
                  }),
                ]),
                styleBox,
              ]),
            ]),
          ]),
          el('div.card', null, [
            el('div.row.between', null, [
              el('h3', { text: 'Escudería' }),
              button('Al azar', { kind: 'ghost', small: true, title: 'Elegir equipo al azar', onClick: () => { form.teamId = null; form.replaceDriverId = undefined; renderTeams(); renderSeats(); } }),
            ]),
            teamList,
          ]),
          el('div.card', null, [el('h3', { text: 'Asiento en la parrilla' }), seatBox]),
        ]),
        el('div.stack', null, [
          preview,
          el('div.info-card', null, [
            el('h3', { text: 'Tu camino' }),
            el('ul', null, [
              el('li', { text: 'Temporada de debut en F2 con 14 citas.' }),
              el('li', { text: 'Termina entre los tres primeros para subir a F1.' }),
              el('li', { text: 'Repite la temporada si no alcanzas el objetivo.' }),
              el('li', { text: 'Objetivos del jefe, buzón y garage entre semana.' }),
            ]),
          ]),
        ]),
      ]),
    ]));
  },
};

  __x.driverCreateScreen = driverCreateScreen;
};
__registry["js/ui/screens/garage.js"] = function (__x, __req) {
// Garage: estado del coche, atributos, plantilla y modelo para la próxima cita.

const { el, bar } = __req("js/ui/dom.js");
const { teamCard, carStats, driverCard, currentRound } = __req("js/game/career.js");
const { teamBadge } = __req("js/ui/screens/tables.js");
const { ctx } = __req("js/ui/context.js");

async function showGarage(shell) {
  const state = ctx.career;
  if (!state) return;
  const crew = teamCard(state);
  const card = driverCard(state);
  const stats = carStats(state);
  const round = currentRound(state);
  const teammates = (state.entryList || []).filter((e) => e.teamId === state.teamId && e.driverId !== state.driver.id);
  const budget = crew.team.car?.budget ?? 0;

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('div.row.row-tight', null, [
          teamBadge(state.teamId, state.series, { size: 26 }),
          el('h2', { text: `Garaje · ${crew.team.name}` }),
        ]),
        el('div.sub', { text: `${crew.team.fullName || ''} ${crew.team.flag || ''}` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip', { text: `Presupuesto ${budget}` }),
        el('span.chip', { text: `Nivel ${crew.level || 1}` }),
      ]),
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [
        el('div.card', null, [
          el('h3', { text: 'Monocasco' }),
          el('div.grid.grid-3', null, stats.filter((s) => s.key !== 'Presupuesto').map((s) => el('div.pad-sm', { style: { background: 'var(--ink-3)', borderRadius: 'var(--r-sm)' } }, [
            el('div.row.between', null, [
              el('span.dim', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em' }, text: s.key }),
              el('b.mono', { text: String(s.value) }),
            ]),
            bar(s.value, 100, s.value >= 90 ? 'good' : s.value >= 75 ? '' : 'warn'),
          ]))),
          el('div.hint', { style: { marginTop: '8px' }, text: 'El monoplaza se entrega tal cual: no hay mejoras ni desarrollo durante la temporada. Todo depende del equipo que haya firmado contigo y de tus propias manos al volante.' }),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Tu piloto' }),
          el('div.grid.grid-2', null, Object.entries(card.ratings || {}).map(([key, value]) => el('div.stat-line', null, [
            el('span.muted', { text: RATING_LABELS[key] || key }),
            el('b', { text: String(value) }),
          ]))),
          el('div.row.row-tight', { style: { marginTop: '8px' } }, (card.traits || []).map((t) => el('span.chip.chip-blue', { text: t }))),
        ]),
      ]),
      el('div.stack', null, [
        el('div.card.accent', null, [
          el('h3', { text: 'Compañeros' }),
          ...teammates.map((e) => el('div.stat-line', null, [
            el('span', null, el('div.driver-cell', null, [el('span.flag', { text: e.flag || '' }), el('span', { text: e.name })])),
            el('b.mono', { text: e.ratings ? String(Math.round(Object.values(e.ratings).reduce((a, b) => a + b, 0) / Object.values(e.ratings).length)) : '—' }),
          ])),
          teammates.length === 0 ? el('div.hint', { text: 'Slot libre: piloto titular en pruebas.' }) : null,
        ]),
        el('div.card', null, [
          el('h3', { text: 'Staff' }),
          ...Object.entries(crew.team.staff || {}).map(([role, person]) => el('div.stat-line', null, [
            el('span', null, el('div', null, [
              el('div', { text: person.name }),
              el('div.dim', { style: { fontSize: '11px' }, text: `${ROLE[role] || role} · ${person.style}` }),
            ])),
            el('span.flag', { text: person.flag || '' }),
          ])),
          el('div.hint', { style: { marginTop: '8px' }, text: crew.team.motto || '' }),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Próxima cita' }),
          el('div.hint', { text: round ? `${round.flag} ${round.gp} · ${round.circuit.name} (${round.circuit.length} km)` : 'Temporada completada' }),
        ]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Garaje', subtitle: crew.team.name });
}

const RATING_LABELS = {
  pace: 'Ritmo',
  braking: 'Frenada',
  control: 'Control',
  consistency: 'Consistencia',
  racecraft: 'Oficio',
  quali: 'Clasificación',
  tyre: 'Gestión de neumáticos',
  starts: 'Salidas',
  wet: 'Mojado',
};

const ROLE = {
  principal: 'Jefe de equipo',
  deputy: 'Director deportivo',
  chiefMechanic: 'Jefe de mecánicos',
  raceEngineer: 'Ingeniero de pista',
  performance: 'Director de rendimiento',
};

  __x.showGarage = showGarage;
};
__registry["js/ui/screens/howto.js"] = function (__x, __req) {
// Guía rápida: controles, sistemas de carrera y camino a F1.

const { el, button } = __req("js/ui/dom.js");
const { RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS, MISSED_PIT_PENALTY_S } = __req("js/game/race.js");

async function showHowTo(shell, { onBack } = {}) {
  const section = (title, rows) => el('div.card', null, [
    el('h3', { text: title }),
    el('dl.kv', null, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
  ]);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: 'Cómo se juega' }),
        el('div.sub', { text: 'Controles, sistemas de carrera y ascenso a F1' }),
      ]),
      onBack ? button('Volver', { kind: 'primary', onClick: onBack }) : null,
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [
        section('Controles', [
          ['Subir acelerador', 'W / ↑'],
          ['Frenar y marcha atrás', 'S / ↓'],
          ['Dirección', 'A / D o ← / →'],
          ['Freno de mano', 'Espacio'],
          ['DRS', 'E'],
          ['Entrar en boxes', 'P'],
          ['Reincorporarse', 'R'],
          ['Cámara', 'C'],
          ['Pausa', 'Esc o Tab'],
          ['Simulación ×1/×2/×3', '4 / 5 / 6'],
        ]),
        section('Carrera', [
          ['Distancia', `${RACE_LAPS} vueltas en F1 y F2; el sprint son ${SPRINT_LAPS}`],
          ['Parada obligatoria', `${MAX_PIT_STOPS === 1 ? 'Una sola parada' : `${MAX_PIT_STOPS} paradas`}; sin parar, +${MISSED_PIT_PENALTY_S} s de penalización`],
          ['Neumáticos', 'C5 blandos (7 vueltas, los más rápidos), C3 medios (12), C2 duros (16, algo más lentos)'],
          ['Pista', 'Siempre en seco: no hay gomas de lluvia'],
          ['ERS', 'Se despliega en las rectas y se recupera frenando'],
          ['Daño', 'Sin pasar por boxes se acumula y acaba en el abandono'],
          ['Bandera amarilla', 'No se puede ganar posición; el coche de seguridad te devuelve a pista'],
        ]),
      ]),
      el('div.stack', null, [
        el('div.card', null, [
          el('h3', { text: 'Modo carrera' }),
          el('ul', { style: { margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: '1.7', color: 'var(--text-2)' } }, [
            el('li', { text: 'Empiezas en F2 con 14 citas y 22 pilotos.' }),
            el('li', { text: 'Ganas puntos en carrera, sprint y vuelta rápida.' }),
            el('li', { text: 'Termina entre los tres primeros para subir a F1.' }),
            el('li', { text: 'Si no llegas, repites la temporada con mejoras.' }),
            el('li', { text: 'En F1 son 23 grandes premios y sprints en seis citas.' }),
            el('li', { text: 'El jefe escribe correos con objetivos: léelos y complétalos.' }),
          ]),
        ]),
        el('div.card.accent', null, [
          el('h3', { text: 'Juego de fans' }),
          el('div.hint', { text: 'Proyecto no oficial, sin relación con Formula One, la FIA ni los equipos y pilotos citados. Todo el guardado es local.' }),
        ]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Guía', subtitle: 'Controles y sistemas' });
}

  __x.showHowTo = showHowTo;
};
__registry["js/ui/screens/inbox.js"] = function (__x, __req) {
// Buzón: correo del equipo (jefe, ingeniero, mecánicos) y noticias.

const { el, button, formatDate } = __req("js/ui/dom.js");
const { markMailRead, markNewsRead, refreshInbox, refreshNews, currentRound } = __req("js/game/career.js");
const { roleLabel } = __req("js/game/mail.js");
const { ctx } = __req("js/ui/context.js");
const { autosave } = __req("js/ui/save.js");

async function showInbox(shell, { tab = 'mail' } = {}) {
  const state = ctx.career;
  if (!state) return;
  let active = tab;

  const body = el('div.stack');
  const tabs = el('div.segmented', { style: { maxWidth: '320px' } });

  const renderTabs = () => {
    tabs.textContent = '';
    tabs.append(
      el('button', {
        type: 'button', text: `Correo (${state.unreadMail || 0})`,
        'aria-pressed': String(active === 'mail'),
        on: { click: () => { active = 'mail'; paint(); } },
      }),
      el('button', {
        type: 'button', text: `Noticias (${state.unreadNews || 0})`,
        'aria-pressed': String(active === 'news'),
        on: { click: () => { active = 'news'; paint(); } },
      }),
    );
  };

  const openMail = async (item) => {
    markMailRead(state, item.id);
    autosave();
    await shell.modal({
      title: item.subject,
      body: el('div.stack', null, [
        el('div.row.row-tight', null, [
          el('span.chip', { text: roleLabel(item.role) || 'Equipo' }),
          el('span.chip', { text: item.from }),
        ]),
        el('p', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13.5px' }, text: item.body }),
      ]),
      actions: [{ label: 'Entendido', kind: 'primary', value: 'ok' }],
    });
    paint();
  };

  const openNews = async (item) => {
    markNewsRead(state, item.id);
    autosave();
    await shell.modal({
      title: item.title,
      body: el('div.stack', null, [
        el('div.row.row-tight', null, [
          el('span.chip.chip-red', { text: item.tagLabel || 'Noticia' }),
          el('span.chip', { text: item.source || 'SportFeed' }),
          el('span.chip', { text: formatDate(item.date) }),
        ]),
        el('p', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13.5px' }, text: item.body }),
      ]),
      actions: [{ label: 'Cerrar', kind: 'primary', value: 'ok' }],
    });
    paint();
  };

  const paint = () => {
    renderTabs();
    body.textContent = '';
    const list = active === 'mail' ? (state.inbox || []) : (state.news || []);
    if (!list.length) {
      body.append(el('div.card', null, el('div.hint', { text: active === 'mail' ? 'No hay correo todavía.' : 'No hay noticias todavía.' })));
    }
    for (const item of [...list].reverse()) {
      if (active === 'mail') {
        body.append(el('button.mail-item', {
          class: item.unread ? 'unread' : '',
          type: 'button',
          on: { click: () => openMail(item) },
        }, [
          el('div.row.between', null, [
            el('span.from', { text: `${item.flag || ''} ${item.from} · ${roleLabel(item.role) || 'Equipo'}` }),
            item.unread ? el('span.chip.chip-red', { text: 'Nuevo' }) : null,
          ].filter(Boolean)),
          el('div.subject', { text: item.subject }),
        ]));
      } else {
        body.append(el('button.mail-item', {
          class: item.unread ? 'unread' : '',
          type: 'button',
          on: { click: () => openNews(item) },
        }, [
          el('div.row.between', null, [
            el('span.from', { text: `${item.tagLabel || 'Noticia'} · ${item.source || 'SportFeed'}` }),
            el('span.from', { text: formatDate(item.date) }),
          ]),
          el('div.subject', { text: item.title }),
        ]));
      }
    }
  };

  paint();

  const round = currentRound(state);
  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: 'Buzón' }),
        el('div.sub', { text: round ? `Semana de ${round.gp}` : 'Temporada completada' }),
      ]),
      el('div.row.row-tight', null, [
        button('Actualizar', {
          kind: 'ghost',
          onClick: () => {
            refreshInbox(state);
            refreshNews(state);
            paint();
            shell.toast('Buzón actualizado.', 'good');
          },
        }),
        button('Marcar leídos', {
          kind: 'ghost',
          onClick: () => {
            markMailRead(state, null);
            markNewsRead(state, null);
            paint();
          },
        }),
      ]),
    ]),
    tabs,
    body,
  ]));

  shell.setChrome({
    title: 'Buzón',
    subtitle: `${state.unreadMail || 0} correos y ${state.unreadNews || 0} noticias sin leer`,
  });
}

  __x.showInbox = showInbox;
};
__registry["js/ui/screens/paddock.js"] = function (__x, __req) {
// Paddock: pantalla central de la carrera profesional.
// Muestra la próxima cita, el estado del championship, los objetivos del jefe
// y da acceso al fin de semana, clasificación, calendario, buzón y garage.

const { el, button, bar, formatDate } = __req("js/ui/dom.js");
const { standingsTable, teamBadge } = __req("js/ui/screens/tables.js");
const { buildStandings, playerRow, teamRow } = __req("js/game/standings.js");
const { currentRound, daysToRound, isSeasonOver, repeatSeason, promoteToF1, driverCard, teamCard, carStats } = __req("js/game/career.js");
const { ctx, canRun } = __req("js/ui/context.js");

async function showPaddock(shell, params = {}) {
  const state = ctx.career;
  if (!state) return;
  const round = currentRound(state);
  const card = driverCard(state);
  const crew = teamCard(state);
  const seriesName = state.series === 'f1' ? 'Fórmula 1' : 'Fórmula 2';
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const me = playerRow(standings, state.driver.id);
  const myTeam = teamRow(standings, state.teamId);
  const pending = round ? round.sessions.find((s) => s.required && !s.played) : null;
  const days = daysToRound(state);
  const seasonOver = isSeasonOver(state);
  const played = round ? round.sessions.filter((s) => s.played).length : 0;
  const total = round ? round.sessions.length : 0;

  const chips = [
    el('span.chip.chip-red', { text: seriesName }),
    el('span.chip', { text: `Ronda ${state.round}/${state.series === 'f1' ? 23 : 14}` }),
    me ? el('span.chip', { text: `P${me.position} · ${me.points} pts` }) : null,
    state.unreadMail ? el('span.chip.chip-amber', { text: `${state.unreadMail} sin leer` }) : null,
  ];

  const seasonCard = el('div.card.accent', null, [
    el('div.row.between', null, [
      el('div', null, [
        el('div.eyebrow', { text: seasonOver ? 'Temporada cerrada' : 'Próxima cita' }),
        el('div', { style: { fontSize: '22px', fontWeight: '800' }, text: round ? `${round.flag} ${round.gp}` : 'Temporada completada' }),
        el('div.dim', { style: { fontSize: '12px' }, text: round ? `${round.circuit.name} · ${round.circuit.length} km · ${played}/${total} sesiones` : '' }),
      ]),
      el('div', { style: { textAlign: 'right' } }, [
        el('div.big.mono', { text: days !== null ? String(days) : '—' }),
        el('div.dim', { style: { fontSize: '11px' }, text: days === null ? '' : days === 1 ? 'día para el domingo' : 'días para el domingo' }),
      ]),
    ]),
    el('div.row', { style: { marginTop: '12px' } }, [
      button(round ? 'Abrir fin de semana' : 'Ver clasificación', {
        kind: 'primary',
        onClick: async () => {
          const { showWeekend } = await __lazy("js/ui/screens/weekend.js");
          await showWeekend(shell, {});
        },
      }),
      pending && round ? button(`Simular hasta ${pending.short}`, {
        kind: 'ghost',
        title: 'Rellena las sesiones opcionales que falten',
        onClick: async () => {
          const { simulateRest } = await __lazy("js/ui/sim.js");
          simulateRest(ctx, shell);
          await showPaddock(shell, {});
        },
      }) : null,
      seasonOver ? button('Cerrar temporada', { kind: 'primary', onClick: () => showSeasonEnd(shell) }) : null,
    ]),
  ]);

  const weekend = round ? el('div.card', null, [
    el('h3', { text: 'Programa del fin de semana' }),
    el('div.week', null, round.sessions.map((s) => {
      const runnable = canRun(s, round);
      return el('button.session-row', {
        class: `${s.played ? 'played' : ''} ${pending && s.id === pending.id ? 'next' : ''}`,
        type: 'button',
        disabled: s.played || !runnable,
        on: {
          click: async () => {
            const { showSession } = await __lazy("js/ui/screens/session.js");
            await showSession(shell, { session: s, round });
          },
        },
      }, [
        el('div', { style: { width: '46px' } }, [
          el('div.when', { text: formatDate(s.date) }),
          el('div.state', { text: `${s.minutes} min` }),
        ]),
        el('div.grow', null, [
          el('div.what', { text: s.name }),
          el('div.state', {
            text: s.played
              ? `Completada · ${s.result?.player?.position ? `P${s.result.player.position}` : 'sin posición'}`
              : s.required ? 'Obligatoria' : 'Opcional',
          }),
        ]),
        s.result?.player ? el('span.chip', { text: `P${s.result.player.position}` }) : null,
        el('span.chip', { class: s.played ? 'chip-green' : pending && s.id === pending.id ? 'chip-red' : '', text: s.played ? 'Hecho' : pending && s.id === pending.id ? 'Siguiente' : canRun(s, round) ? 'Disponible' : 'Bloqueada' }),
      ]);
    })),
  ]) : null;

  const objectives = el('div.card', null, [
    el('h3', { text: 'Objectives del jefe' }),
    ...(state.objectives || []).map((o) => el('div', { style: { padding: '7px 0', borderTop: '1px solid rgba(35,40,56,.6)' } }, [
      el('div.row.between', null, [
        el('span', { style: { fontSize: '13px' }, text: o.text }),
        el('span.chip', { class: o.done ? 'chip-green' : '', text: o.done ? 'Hecho' : `${Math.round((o.progress || 0) * 100)}%` }),
      ]),
      bar((o.progress || 0) * 100, 100, o.done ? 'good' : ''),
    ])),
    el('div.hint', { style: { marginTop: '8px' }, text: staffHint(state) }),
  ]);

  const standingsCard = el('div.card', null, [
    el('div.row.between', null, [
      el('h3', { text: 'Mundial' }),
      button('Completo', { kind: 'ghost', small: true, onClick: async () => { const { showStandings } = await __lazy("js/ui/screens/standings.js"); await showStandings(shell, {}); } }),
    ]),
    el('div.table-scroll', null, standingsTable(standings, { playerId: state.driver.id, limit: 8 })),
    myTeam ? el('div.hint', { style: { marginTop: '8px' }, text: `${crew.team.name}: ${myTeam.position}º con ${myTeam.points} puntos.` }) : null,
  ]);

  const garageCard = el('div.card', null, [
    el('div.row.between', null, [
      el('h3', { text: 'Garaje' }),
      button('Abrir', { kind: 'ghost', small: true, onClick: async () => { const { showGarage } = await __lazy("js/ui/screens/garage.js"); await showGarage(shell, {}); } }),
    ]),
    el('div.grid.grid-3', { style: { marginTop: '4px' } }, carStats(state).map((s) => el('div', null, [
      el('div.dim', { style: { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em' }, text: s.key }),
      el('div.mono', { style: { fontSize: '17px', fontWeight: '800' }, text: String(s.value) }),
    ]))),
  ]);

  const newsCard = el('div.card', null, [
    el('div.row.between', null, [
      el('h3', { text: 'Últimas noticias' }),
      button('Buzón', { kind: 'ghost', small: true, onClick: async () => { const { showInbox } = await __lazy("js/ui/screens/inbox.js"); await showInbox(shell, {}); } }),
    ]),
    ...(state.news || []).slice(0, 3).map((n) => el('div', { style: { padding: '6px 0', borderTop: '1px solid rgba(35,40,56,.6)' } }, [
      el('div.row.row-tight', null, [
        el('span.chip', { class: n.unread ? 'chip-red' : '', text: n.tagLabel || 'Noticia' }),
        el('span.dim', { style: { fontSize: '11px' }, text: formatDate(n.date) }),
      ]),
      el('div', { style: { fontSize: '13px', fontWeight: '600' }, text: n.title }),
    ])),
    (state.news || []).length === 0 ? el('div.hint', { text: 'Todavía no hay noticias.' }) : null,
  ]);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `${card.flag} ${card.name}` }),
        el('div.sub', { text: `${card.nationality} · ${card.age} años · #${card.number} · ${crew.team.name}` }),
      ]),
      el('div.row.row-tight', null, chips),
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [seasonCard, weekend, standingsCard]),
      el('div.stack', null, [objectives, garageCard, newsCard]),
    ]),
  ]));

  shell.setChrome({
    title: 'Paddock',
    subtitle: round ? `${round.flag} ${round.gp}` : 'Temporada completada',
    chips,
  });
}

function staffHint(state) {
  const staff = state.team?.staff;
  if (!staff) return '';
  const principal = staff.principal;
  return `${principal.name}, ${principal.style}: «${staff.motto || 'trabaja conmigo'}»`;
}

async function showSeasonEnd(shell) {
  const state = ctx.career;
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const me = playerRow(standings, state.driver.id);
  const champion = standings.drivers?.[0];
  const position = me?.position ?? 99;
  const promoted = state.series === 'f2' && position <= 3;

  const body = el('div.stack', null, [
    el('p', { text: promoted
      ? `Terminas ${position}º el campeonato de F2 con ${me.points} puntos. Hay un asiento en F1 esperándote.`
      : `Terminas ${position}º el campeonato con ${me.points} puntos. El objetivo del jefe no se cumple este año.` }),
    el('div.table-scroll', null, standingsTable(standings, { playerId: state.driver.id, limit: 5 })),
  ]);

  const actions = [];
  if (promoted) actions.push({ label: 'Firmar por F1', kind: 'primary', value: 'promote' });
  actions.push({ label: 'Repetir temporada', value: 'repeat' });

  const choice = await shell.modal({
    title: promoted ? '¡Subes a Fórmula 1!' : 'Fin de temporada',
    body,
    actions,
    dismissable: false,
  });

  if (choice === 'promote') {
    const choice2 = await pickF1Team(shell);
    if (!choice2) {
      shell.toast('No has elegido equipo. Repite temporada.', 'warn');
      repeatSeason(state);
      await showPaddock(shell, {});
      return;
    }
    promoteToF1(state, choice2);
    shell.toast('Fichaje firmado. Bienvenido a la parrilla de F1.', 'good');
    await showPaddock(shell, {});
  } else if (choice === 'repeat') {
    repeatSeason(state);
    shell.toast('Temporada repetida. Vuelta a empezar.', 'warn');
    await showPaddock(shell, {});
  } else {
    await showPaddock(shell, {});
  }
}

async function pickF1Team(shell) {
  const { teamsFor } = await __lazy("js/data/teams.js");
  const teams = teamsFor('f1').slice().sort((a, b) => (a.tier || 0) - (b.tier || 0));
  let picked = null;
  const list = el('div.pick-list');
  const paint = () => {
    list.textContent = '';
    for (const team of teams) {
      list.append(el('button.pick', {
        type: 'button',
        'aria-pressed': String(picked === team.id),
        on: { click: () => { picked = team.id; paint(); } },
      }, [
        teamBadge(team.id, 'f1', { size: 26 }),
        el('span.grow', null, [
          el('span.t', { text: team.name }),
          el('span.d', { text: `${team.titles} títulos · potencia ${team.car.power} · ${team.hq}` }),
        ]),
        el('span.chip', { text: team.tier === 1 ? 'Top' : team.tier === 2 ? 'Media' : 'Resto' }),
      ]));
    }
  };
  paint();
  const choice = await shell.modal({
    title: 'Elige tu escudería de F1',
    body: el('div.stack', null, [el('p.hint', { text: 'El equipo con más títulos ofrece mejor coche, pero la presión también es mayor.' }), list]),
    actions: [{ label: 'Firmar', kind: 'primary', value: 'ok' }, { label: 'Cancelar', value: null }],
  });
  return choice === 'ok' ? picked : null;
}

const paddockScreen = { id: 'paddock', render: (shell) => showPaddock(shell, {}) };

  __x.showPaddock = showPaddock;
  __x.paddockScreen = paddockScreen;
};
__registry["js/ui/screens/results.js"] = function (__x, __req) {
// Resultados de la sesión recién disputada: posición, puntos, vuelta rápida,
// clasificación del campeonato y avance a la siguiente cita.

const { el, button } = __req("js/ui/dom.js");
const { resultTable, fastestLapCard, playerSummary, standingsTable, constructorsTable } = __req("js/ui/screens/tables.js");
const { buildStandings, playerRow, scoreSession } = __req("js/game/standings.js");
const { roundFinished, isSeasonOver } = __req("js/game/career.js");
const { ctx } = __req("js/ui/context.js");

async function showResults(shell, { sessionDef, round, payload, wasDnf } = {}) {
  const state = ctx.career;
  const result = payload || ctx.lastResult;
  if (!result) return;
  const isQuali = result.kind === 'quali' || result.kind === 'sprintQuali';
  const isRace = result.kind === 'feature' || result.kind === 'sprint';
  const me = (result.entries || []).find((e) => e.driverId === state.driver.id);
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const row = playerRow(standings, state.driver.id);
  const points = isRace ? (scoreSession(result).find((e) => e.driverId === state.driver.id)?.points ?? 0) : 0;

  const headline = isQuali
    ? `Parrilla ${me?.grid ?? '—'}`
    : `P${me?.position ?? '—'}${isRace ? ` · ${me?.points ?? 0} pts` : ''}`;

  const next = round?.sessions?.find((s) => s.required && !s.played);
  const finished = round ? roundFinished(state) : false;

  shell.stack.length = 0;

  const actions = [];
  if (next && !finished) {
    actions.push(button(`Ir a ${next.short}`, {
      kind: 'primary',
      onClick: async () => {
        if (finished && isSeasonOver(state)) {
          const { showPaddock } = await __lazy("js/ui/screens/paddock.js");
          await showPaddock(shell, {});
          return;
        }
        const { showSession } = await __lazy("js/ui/screens/session.js");
        await showSession(shell, { session: next, round });
      },
    }));
  }
  actions.push(button('Paddock', {
    kind: next ? 'ghost' : 'primary',
    onClick: async () => {
      const { showPaddock } = await __lazy("js/ui/screens/paddock.js");
      await showPaddock(shell, {});
    },
  }));

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `${sessionDef?.name || 'Sesión'} · ${round?.circuit?.name || ''}` }),
        el('div.sub', { text: `${round?.flag || ''} ${round?.gp || ''} · ${round?.circuit?.weather || ''}` }),
      ]),
      el('div.row.row-tight', null, actions),
    ]),
    el('div.grid.grid-side', null, [
      el('div.stack', null, [
        el('div.card.accent', null, [
          el('div.row.between', null, [
            el('div', null, [
              el('div.eyebrow', { text: wasDnf ? 'Abandono' : 'Tu resultado' }),
              el('div', { style: { fontSize: '30px', fontWeight: '900' }, text: headline }),
            ]),
            el('div', { style: { textAlign: 'right' } }, [
              isRace ? el('div.big.mono', { text: `+${points}` }) : null,
              isRace ? el('div.dim', { style: { fontSize: '11px' }, text: 'puntos' }) : null,
            ]),
          ]),
          el('div.row.row-tight', { style: { marginTop: '10px' } }, [
            playerSummary(me),
            wasDnf && me?.retireReason ? el('span.chip.chip-red', { text: me.retireReason }) : null,
          ]),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Clasificación de la sesión' }),
          el('div.table-scroll', null, resultTable(result, { playerId: state.driver.id, isQuali, series: state.series })),
        ]),
        isQuali && result.grid ? el('div.card', null, [
          el('h3', { text: 'Parrilla oficial' }),
          el('div.table-scroll', null, resultTable({ ...result, entries: result.grid }, { playerId: state.driver.id, isQuali: true, series: state.series })),
        ]) : null,
      ]),
      el('div.stack', null, [
        fastestLapCard(result, { playerId: state.driver.id }),
        el('div.card', null, [
          el('h3', { text: 'Mundial tras esta sesión' }),
          el('div.row.row-tight', null, [
            el('span.chip', { text: `P${row?.position ?? '—'}` }),
            el('span.chip', { text: `${row?.points ?? 0} pts` }),
            row?.best ? el('span.chip', { text: `Mejor: P${row.best}` }) : null,
          ]),
          el('div.table-scroll', { style: { marginTop: '8px' } }, standingsTable(standings, { playerId: state.driver.id, limit: 10, series: state.series })),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Constructores' }),
          el('div.table-scroll', null, constructorsTable(standings, { teamId: state.teamId, limit: 5, series: state.series })),
        ]),
        next ? el('div.card.accent', null, [
          el('div.eyebrow', { text: 'Siguiente en el calendario' }),
          el('div', { style: { fontSize: '16px', fontWeight: '700' }, text: next.name }),
          el('div.hint', { text: `${next.minutes} minutos · ${next.required ? 'obligatoria' : 'opcional'}` }),
        ]) : null,
      ]),
    ]),
  ]));

  shell.setChrome({
    title: 'Resultados',
    subtitle: `${sessionDef?.name || ''} · ${round?.circuit?.name || ''}`,
    chips: [el('span.chip', { text: headline })],
  });
}

  __x.showResults = showResults;
};
__registry["js/ui/screens/saves.js"] = function (__x, __req) {
// Gestión de partidas guardadas: tres huecos locales con exportar e importar.

const { el, button, formatDate } = __req("js/ui/dom.js");
const { listSlots, readSlot, deleteSlot, exportSlot, importSlot, pickTextFile, SLOT_COUNT } = __req("js/core/storage.js");
const { ctx } = __req("js/ui/context.js");

async function showSaves(shell, { onPick, onBack } = {}) {
  const paint = () => {
    const slots = listSlots();
    const cards = slots.map((slot) => {
      const meta = slot.meta || {};
      const isActive = ctx.slot === slot.index;
      return el('div.card', { style: isActive ? 'border-color:var(--red)' : '' }, [
        el('div.row.between', null, [
          el('div.row.row-tight', null, [
            el('span.chip', { class: meta.series === 'f1' ? 'chip-red' : 'chip-blue', text: meta.series === 'f1' ? 'F1' : 'F2' }),
            el('span.chip', { text: `Hueco ${slot.index + 1}` }),
            isActive ? el('span.chip.chip-green', { text: 'En uso' }) : null,
          ].filter(Boolean)),
        ]),
        slot.empty
          ? el('div.hint', { text: 'Hueco libre.' })
          : el('div.stack', { style: { marginTop: '8px', gap: '4px' } }, [
            el('div', { style: { fontSize: '17px', fontWeight: '800' }, text: `${meta.driverFlag || ''} ${meta.driverName || 'Piloto'}` }),
            el('div.dim', { style: { fontSize: '12px' }, text: `${meta.teamName || ''} · ronda ${meta.round ?? '—'} · P${meta.position ?? '—'} · ${meta.points ?? 0} pts` }),
            el('div.dim', { style: { fontSize: '11px' }, text: meta.savedAt ? `Guardado ${formatDate(meta.savedAt.slice(0, 10))}` : '' }),
          ]),
        el('div.row.row-tight', { style: { marginTop: '12px' } }, [
          slot.empty ? null : button('Cargar', {
            kind: 'primary',
            small: true,
            onClick: async () => {
              const data = readSlot(slot.index);
              if (!data) return;
              const { hydrateState } = await __lazy("js/game/career.js");
              ctx.career = hydrateState(data.state || data);
              ctx.slot = slot.index;
              shell.toast('Partida cargada.', 'good');
              onPick?.(slot.index);
            },
          }),
          slot.empty ? null : button('Exportar', { kind: 'ghost', small: true, onClick: () => exportSlot(slot.index) }),
          slot.empty ? null : button('Borrar', {
            kind: 'ghost',
            small: true,
            onClick: async () => {
              const ok = await shell.modal({
                title: 'Borrar partida',
                body: el('p.hint', { text: `Se eliminará el hueco ${slot.index + 1} de forma permanente.` }),
                actions: [{ label: 'Borrar', kind: 'primary', value: 'ok' }, { label: 'Cancelar', value: null }],
              });
              if (ok === 'ok') {
                deleteSlot(slot.index);
                if (ctx.slot === slot.index) ctx.career = null;
                paint();
                shell.toast('Partida borrada.', 'warn');
              }
            },
          }),
        ].filter(Boolean)),
      ]);
    });

    shell.mount(el('div.screen', null, [
      el('div.screen-head', null, [
        el('div', null, [
          el('h2', { text: 'Partidas guardadas' }),
          el('div.sub', { text: `${SLOT_COUNT} huecos en este dispositivo, sin cuentas ni nube` }),
        ]),
        el('div.row.row-tight', null, [
          button('Importar', {
            kind: 'ghost',
            onClick: async () => {
              const json = await pickTextFile();
              if (!json) return;
              try {
                const index = importSlot(json);
                shell.toast(`Partida importada en el hueco ${index + 1}.`, 'good');
                paint();
              } catch (err) {
                shell.toast(err.message || 'No se pudo importar.', 'bad');
              }
            },
          }),
          onBack ? button('Volver', { kind: 'primary', onClick: onBack }) : null,
        ].filter(Boolean)),
      ]),
      el('div.grid.grid-3', null, cards),
      el('div.card', null, el('div.hint', { text: 'El autoguardado se escribe después de cada sesión. Si el navegador bloquea el almacenamiento, la partida solo vive en memoria.' })),
    ]));
    shell.setChrome({ title: 'Partidas', subtitle: `${slots.filter((s) => !s.empty).length} de ${SLOT_COUNT} en uso` });
  };

  paint();
}

  __x.showSaves = showSaves;
};
__registry["js/ui/screens/session.js"] = function (__x, __req) {
// Pantalla de sesión: monta el lienzo, el HUD y el bucle de simulación.
// Es la pantalla más pesada: mantiene su propio requestAnimationFrame y
// detiene el resto de la interfaz mientras corre.

const { el, button, formatTime } = __req("js/ui/dom.js");
const { createSession, updateSession, RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS } = __req("js/game/race.js");
const { TYRES, TYRE_ORDER, tyrePace } = __req("js/game/car.js");
const { getCircuit } = __req("js/data/circuits.js");
const { recordSession, currentRound, roundFinished, advanceToNextRound, gridEntryList } = __req("js/game/career.js");
const { TrackView } = __req("js/render/track-view.js");
const { Hud } = __req("js/render/hud.js");
const { input } = __req("js/core/input.js");
const { audio } = __req("js/core/audio.js");
const { ctx, buildTeamIndex } = __req("js/ui/context.js");
const { autosave } = __req("js/ui/save.js");

const SIM_STEP = 1 / 60;

/** Vueltas según el tipo de sesión. */
function lapsFor(kind) {
  if (kind === 'sprint') return SPRINT_LAPS;
  if (kind === 'feature') return RACE_LAPS;
  return 0;
}

/**
 * Pantalla previa a la parrilla: el jugador elige con qué neumático sale.
 * Los blandos son los más rápidos pero duran 7 vueltas, así que hay que
 * llegar a la parada con ellos.
 */
async function pickStartTyre(shell, { laps, lastTyre }) {
  const detail = (id) => {
    const t = TYRES[id];
    const pace = Math.round((tyrePace(id, 0) - 1) * 100);
    return `${t.name} · vida ${t.life} vueltas · ${pace >= 0 ? '+' : ''}${pace}% de ritmo`;
  };
  const pick = await shell.modal({
    title: 'Neumático de salida',
    body: el('div.stack', null, [
      el('p.muted', {
        text: `${laps} vueltas y ${MAX_PIT_STOPS} parada${MAX_PIT_STOPS > 1 ? 's' : ''} obligatoria${MAX_PIT_STOPS > 1 ? 's' : ''}. Elige con qué compuesto sales: el desgaste llega al final de su vida.`,
      }),
      el('ul.tyre-list', null, TYRE_ORDER.map((id) =>
        el('li.tyre-item', null, [
          el('span.tyre-dot', { style: `background:${TYRES[id].color}` }),
          el('span.tyre-name', { text: TYRES[id].name }),
          el('span.tyre-life', { text: detail(id) }),
        ])
      )),
      el('p.muted.hint', { text: `Salir con el ${TYRES[lastTyre]?.name || 'medio'} te permite alargar la primera entrada.`, }),
    ]),
    actions: TYRE_ORDER.map((id) => ({
      label: TYRES[id].name,
      kind: id === (lastTyre || 'medium') ? 'primary' : 'ghost',
      value: id,
    })),
    dismissable: true,
  });
  return TYRES[pick] ? pick : lastTyre || 'medium';
}

let active = null;

/** Detiene cualquier sesión en curso. */
function stopSession() {
  if (!active) return;
  active.stop();
  active = null;
}

async function showSession(shell, { session: sessionDef, round } = {}) {
  const state = ctx.career;
  stopSession();
  shell.closeAllModals();
  shell.stack.length = 0;
  resetAudioTriggers();

  const raceRound = round || currentRound(state);
  const circuit = getCircuit(raceRound.circuitId);
  const teamsById = buildTeamIndex(state.series);

  /* Elección de neumático antes de salir a pista */
  const laps = lapsFor(sessionDef.type);
  const startTyre = laps > 0
    ? await pickStartTyre(shell, { laps, lastTyre: ctx.settings.startTyre || 'medium' })
    : 'soft';
  if (laps > 0) ctx.settings.startTyre = startTyre;

  const session = createSession({
    circuit,
    entryList: gridEntryList(state),
    kind: sessionDef.type,
    round: raceRound,
    settings: ctx.settings,
    seed: `${state.seed}|${state.series}|${state.round}|${sessionDef.id}`,
    startTyre,
  });
  ctx.session = session;

  const canvas = el('canvas.race-canvas');
  const hudRoot = el('div');
  const touch = el('div.touch', null, [
    el('div.pad.pad-steer', { dataset: { touch: 'steer' } }, el('div.stick')),
    el('div.pad.pad-thr', { dataset: { touch: 'throttle' }, text: 'ACELERAR' }),
    el('div.pad.pad-brk', { dataset: { touch: 'brake' }, text: 'FRENO' }),
    el('div.pad.pad-drs', { dataset: { actionTouch: 'drs' }, text: 'DRS' }),
    el('div.pad.pad-pit', { dataset: { actionTouch: 'pit' }, text: 'BOXES' }),
  ]);
  const pauseBtn = el('button.btn.btn-ghost.hud-btn', { type: 'button', text: '||', title: 'Pausa (Esc)' });

  const wrap = el('div.race', null, [canvas, hudRoot, touch, pauseBtn]);
  shell.mount(wrap);
  shell.setNav([]);
  shell.setChrome({
    title: `${sessionDef.name} · ${circuit.name}`,
    subtitle: laps > 0
      ? `${raceRound.flag} ${raceRound.gp} · ${laps} vueltas · ${MAX_PIT_STOPS} parada obligatoria · ${TYRES[startTyre].name}`
      : `${raceRound.flag} ${raceRound.gp} · ${circuit.length} km`,
    chips: [
      el('span.chip.chip-red', { text: state.series === 'f1' ? 'F1' : 'F2' }),
      el('span.chip', { text: 'Seco' }),
      laps > 0 ? el('span.chip', { text: `${TYRES[startTyre].name} · ${TYRES[startTyre].life} vueltas` }) : null,
    ].filter(Boolean),
  });

  const view = new TrackView(canvas);
  view.setTrack(session.track, teamsById);
  const hud = new Hud(hudRoot);
  hud.setTrack(session.track);
  hud.setUnits(ctx.settings.units);
  hud.setMinimapVisible(ctx.settings.showMinimap !== false);
  ctx.view = view;
  ctx.hud = hud;

  input.attach(window);
  input.setDrivingEnabled(true);
  input.captureText = false;
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    touch.classList.add('on');
    input.bindTouch(touch);
  }

  audio.resume();
  audio.startEngine({ series: state.series });
  audio.setCrowd(session.kind === 'feature' || session.kind === 'sprint' ? 0.5 : 0.12);

  const runner = {
    session,
    raf: 0,
    accumulator: 0,
    last: performance.now(),
    paused: false,
    finished: false,
    countdown: session.phase === 'countdown' ? 5.9 : 0,
    startedAt: Date.now(),
    pitPrompt: false,
    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      if (this.onKey) window.removeEventListener('keydown', this.onKey);
      input.setDrivingEnabled(false);
      input.detach();
      audio.stopEngine();
      audio.stopLoops();
      audio.setCrowd(0);
      ctx.session = null;
      ctx.view = null;
      ctx.hud = null;
      ctx.running = false;
    },
  };
  active = runner;
  ctx.running = true;

  const onResize = () => {
    view.resize();
    hud.minimap.layout();
  };
  window.addEventListener('resize', onResize);
  runner.onResize = onResize;

  const onKey = (e) => {
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyC') {
      shell.toast(`Cámara: ${view.cycleCamera()}`, 'warn');
    } else if (e.code === 'Digit4' || e.code === 'Digit5' || e.code === 'Digit6') {
      setSimSpeed(Number(e.code.slice(5)) - 3);
    }
  };
  window.addEventListener('keydown', onKey);
  runner.onKey = onKey;

  const setSimSpeed = (value) => {
    const speeds = [1, 2, 3];
    const next = speeds.includes(value) ? value : 1;
    ctx.settings.simSpeed = next;
    shell.toast(`Simulación ×${next}`, 'warn');
  };
  runner.setSimSpeed = setSimSpeed;

  const togglePause = async () => {
    if (runner.finished) return;
    runner.paused = !runner.paused;
    if (runner.paused) {
      input.setDrivingEnabled(false);
      const choice = await shell.modal({
        title: 'Pausa',
        body: el('div.stack', null, [
          el('div.row.row-tight', null, [
            el('span.chip', {
              text: session.laps > 0
                ? `Vuelta ${Math.max(1, session.player.lap)}/${session.laps}`
                : `Vuelta ${Math.max(1, session.player.lap)} · ${formatTime(session.clock * 1000)} de ${formatTime(session.duration * 1000)}`,
            }),
            el('span.chip', { text: `P${session.player.position}` }),
            el('span.chip', { text: `Mejor ${formatTime(session.player.bestLapMs)}` }),
          ]),
          el('div.hint', { text: 'C: cambia de cámara · 4/5/6: velocidad de simulación · P: entrar en boxes · R: reincorporarse.' }),
        ]),
        actions: [
          { label: 'Continuar', kind: 'primary', value: 'resume' },
          { label: 'Reiniciar sesión', value: 'restart' },
          { label: 'Abandonar', value: 'quit' },
        ],
        dismissable: true,
        onClose: () => {
          if (runner.finished) return;
          runner.paused = false;
          input.setDrivingEnabled(true);
        },
      });
      if (choice === 'restart') {
        runner.stop();
        await showSession(shell, { session: sessionDef, round: raceRound });
      } else if (choice === 'quit') {
        runner.stop();
        ctx.career = state;
        const { showPaddock } = await __lazy("js/ui/screens/paddock.js");
        await showPaddock(shell, {});
      }
    } else {
      input.setDrivingEnabled(true);
    }
  };
  runner.togglePause = togglePause;
  pauseBtn.addEventListener('click', togglePause);

  const finish = async () => {
    if (runner.finished) return;
    runner.finished = true;
    runner.stop();
    audio.sfx('finish');

    const payload = { ...session.results, kind: sessionDef.type, round: state.round, sessionId: sessionDef.id };
    recordSession(state, payload);
    if (roundFinished(state)) advanceToNextRound(state);
    autosave();

    const { showResults } = await __lazy("js/ui/screens/results.js");
    await showResults(shell, { sessionDef, round: raceRound, payload, wasDnf: Boolean(session.results.entries.find((e) => e.driverId === state.driver.id)?.retired) });
  };

  const frame = (now) => {
    if (!active) return;
    const wall = Math.min(0.1, (now - runner.last) / 1000);
    runner.last = now;

    if (!runner.paused) {
      const speed = ctx.settings.simSpeed || 1;
      runner.accumulator += wall * speed;
      let steps = 0;
      const controls = input.driving(SIM_STEP);
      runner.controls = controls;
      while (runner.accumulator >= SIM_STEP && steps < 12) {
        updateSession(session, SIM_STEP, controls);
        runner.accumulator -= SIM_STEP;
        steps++;
      }
      if (steps >= 12) runner.accumulator = 0;
      input.endFrame();
      updateAudio(session, controls);
      checkEvents(session);
    }

    view.draw(session);
    hud.update(session);

    if (session.completed && !runner.finished) {
      finish();
      return;
    }
    runner.raf = requestAnimationFrame(frame);
  };
  runner.raf = requestAnimationFrame(frame);

  shell.toast(`${sessionDef.name}: pulsa Esc para pausar.`, 'warn');
  return runner;
}

function updateAudio(session, controls = {}) {
  const p = session.player;
  if (!p) return;
  const throttle = Math.max(0, controls.throttle || 0);
  const brake = Math.max(0, controls.brake || 0);
  audio.updateEngine({
    rpm: p.rpm || 900,
    speed: p.speed || 0,
    throttle: p.speed < 1 ? 0.35 : throttle,
    load: p.drsOpen ? 1 : 0.45 + throttle * 0.55,
  });
  const sliding = !p.onTrack ? 0.55 : (brake > 0.6 && p.speed > 25 ? 0.22 : 0.04);
  audio.setTireScreech(p.speed > 10 ? sliding : 0);
  audio.setSurface(p.onTrack ? 0.12 : 0.5);
}

let lastLap = 1;
let lastPhase = '';
let lastLights = 0;
let lastGear = 1;
let lastDrs = false;
let lastRetired = false;

/** Reinicia los disparadores de sonido entre sesiones. */
function resetAudioTriggers() {
  lastLap = 1;
  lastPhase = '';
  lastLights = 0;
  lastGear = 1;
  lastDrs = false;
  lastRetired = false;
}

function checkEvents(session) {
  const p = session.player;
  if (session.phase !== lastPhase) {
    if (session.phase === 'green') audio.sfx('beepGo');
    lastPhase = session.phase;
  }
  /* Una baliza por luz roja encendida, y el pitido largo al apagarse todas */
  if (session.lights !== lastLights) {
    if (session.lights > lastLights) audio.sfx('beep');
    lastLights = session.lights;
  }
  if (p.lap !== lastLap) {
    lastLap = p.lap;
    audio.sfx('lap');
  }
  if (p.gear !== lastGear) {
    lastGear = p.gear;
    if (p.gear > 1) audio.sfx('gear');
  }
  if (p.drsOpen && !lastDrs) audio.sfx('drs');
  lastDrs = p.drsOpen;
  if (p.retired && !lastRetired) audio.sfx('crash');
  lastRetired = p.retired;
}

  __x.stopSession = stopSession;
  __x.showSession = showSession;
};
__registry["js/ui/screens/settings.js"] = function (__x, __req) {
// Ajustes: sonido, ayudas de conducción y datos.

const { el, button, segmented, toggle } = __req("js/ui/dom.js");
const { RACE_LAPS, SPRINT_LAPS, MAX_PIT_STOPS } = __req("js/game/race.js");
const { storageInfo, downloadText, DEFAULT_SETTINGS } = __req("js/core/storage.js");
const { audio } = __req("js/core/audio.js");
const { ctx, setSettings } = __req("js/ui/context.js");

const DIFFICULTY = {
  amateur: { label: 'Aficionado', desc: 'Estabilidad alta, IA más lenta y menos desgaste.' },
  pro: { label: 'Profesional', desc: 'Equilibrio de carrera.' },
  legendary: { label: 'Leyenda', desc: 'IA rápida y recuperación limitada tras errores.' },
};

async function showSettings(shell, { onBack } = {}) {
  const paint = () => {
    const s = ctx.settings;
    shell.mount(el('div.screen', null, [
      el('div.screen-head', null, [
        el('div', null, [
          el('h2', { text: 'Ajustes' }),
          el('div.sub', { text: 'Se guardan en este dispositivo' }),
        ]),
        onBack ? button('Volver', { kind: 'primary', onClick: onBack }) : null,
      ]),
      el('div.grid.grid-side', null, [
        el('div.stack', null, [
          el('div.card', null, [
            el('h3', { text: 'Conducción' }),
            el('div.field', null, [
              el('label', { text: 'Dificultad' }),
              segmented(Object.entries(DIFFICULTY).map(([value, d]) => ({ value, label: d.label })), s.difficulty, (value) => {
                setSettings({ difficulty: value });
                paint();
              }),
              el('div.err', { text: DIFFICULTY[s.difficulty]?.desc || '' }),
            ]),
            toggle('Ayudas de conducción', 'Control de tracción, ABS y asistencia de dirección', s.assists, (v) => { setSettings({ assists: v }); }),
            toggle('Control de tracción', null, s.tractionControl, (v) => { setSettings({ tractionControl: v }); }),
            toggle('ABS', null, s.abs, (v) => { setSettings({ abs: v }); }),
            toggle('Freno automático', null, s.brakeAssist, (v) => { setSettings({ brakeAssist: v }); }),
            toggle('DRS automático', 'Abre la palanca al entrar en zona', s.autoDrs, (v) => { setSettings({ autoDrs: v }); }),
            el('div.field', null, [
              el('label', { text: `Asistencia de dirección ${Math.round(s.steeringAssist * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.steeringAssist * 100)),
                on: {
                  input: (e) => {
                    setSettings({ steeringAssist: Number(e.target.value) / 100 });
                    e.target.previousElementSibling.textContent = `Asistencia de dirección ${e.target.value}%`;
                  },
                },
              }),
            ]),
            el('div.field', null, [
              el('label', { text: `Estabilidad ${Math.round(s.stability * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.stability * 100)),
                on: {
                  input: (e) => {
                    setSettings({ stability: Number(e.target.value) / 100 });
                    e.target.previousElementSibling.textContent = `Estabilidad ${e.target.value}%`;
                  },
                },
              }),
            ]),
          ]),
          el('div.card', null, [
            el('h3', { text: 'Sesión' }),
            el('p.muted', { text: `Las carreras son siempre de ${RACE_LAPS} vueltas (el sprint, ${SPRINT_LAPS}) con ${MAX_PIT_STOPS === 1 ? 'una' : MAX_PIT_STOPS} parada obligatoria y una sola salida en seco.` }),
            el('div.field', null, [
              el('label', { text: 'Unidades' }),
              segmented([{ value: 'metric', label: 'Métrico (km/h)' }, { value: 'imperial', label: 'Imperial (mph)' }], s.units, (value) => {
                setSettings({ units: value });
                paint();
              }),
            ]),
            toggle('Minimapa', null, s.showMinimap, (v) => { setSettings({ showMinimap: v }); ctx.hud?.setMinimapVisible(v); }),
            toggle('Cronometría en pantalla', null, s.showTiming, (v) => { setSettings({ showTiming: v }); }),
            toggle('Reducir movimiento', 'Menos animaciones y transiciones', s.reduceMotion, (v) => { setSettings({ reduceMotion: v }); }),
          ]),
        ]),
        el('div.stack', null, [
          el('div.card', null, [
            el('h3', { text: 'Sonido' }),
            toggle('Sonido', 'Silencia todo el juego', s.sound, (v) => {
              setSettings({ sound: v });
              audio.setEnabled(v);
              paint();
            }),
            toggle('Efectos', null, s.sfx, (v) => { setSettings({ sfx: v }); }),
            el('div.field', null, [
              el('label', { text: `Motor ${Math.round(s.engineVolume * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.engineVolume * 100)),
                on: { input: (e) => { setSettings({ engineVolume: Number(e.target.value) / 100 }); applyVolumes(); } },
              }),
            ]),
            el('div.field', null, [
              el('label', { text: `Música ${Math.round(s.musicVolume * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.musicVolume * 100)),
                on: { input: (e) => { setSettings({ musicVolume: Number(e.target.value) / 100 }); applyVolumes(); } },
              }),
            ]),
            el('div.field', null, [
              el('label', { text: `Público ${Math.round(s.crowdVolume * 100)}%` }),
              el('input', {
                type: 'range', min: '0', max: '100', value: String(Math.round(s.crowdVolume * 100)),
                on: { input: (e) => { setSettings({ crowdVolume: Number(e.target.value) / 100 }); applyVolumes(); } },
              }),
            ]),
          ]),
          el('div.card', null, [
            el('h3', { text: 'Datos' }),
            el('div.hint', { text: storageText() }),
            el('div.row.row-tight', { style: { marginTop: '10px' } }, [
              button('Restablecer', {
                kind: 'ghost',
                onClick: async () => {
                  const ok = await shell.modal({
                    title: 'Restablecer ajustes',
                    body: el('p.hint', { text: 'Se vuelven a los valores de fábrica. Las partidas guardadas no se tocan.' }),
                    actions: [{ label: 'Sí', kind: 'primary', value: 'ok' }, { label: 'Cancelar', value: null }],
                  });
                  if (ok === 'ok') {
                    setSettings({ ...DEFAULT_SETTINGS });
                    applyVolumes();
                    paint();
                    shell.toast('Ajustes restablecidos.', 'good');
                  }
                },
              }),
              button('Descargar datos', {
                kind: 'ghost',
                onClick: () => {
                  downloadText('predestinato-ajustes.json', JSON.stringify(ctx.settings, null, 2));
                  shell.toast('Ajustes descargados.', 'good');
                },
              }),
            ]),
          ]),
        ]),
      ]),
    ]));
    shell.setChrome({ title: 'Ajustes', subtitle: 'Conducción, sesión y sonido' });
  };

  const applyVolumes = () => audio.setVolumes({
    engine: ctx.settings.engineVolume,
    music: ctx.settings.musicVolume,
    crowd: ctx.settings.crowdVolume,
  });

  paint();
}

function storageText() {
  const info = storageInfo();
  const where = info.inMemory ? 'memoria temporal (sin almacenamiento persistente)' : 'almacenamiento local';
  return `${info.kilobytes} KB usados en ${where}.`;
}

  __x.showSettings = showSettings;
};
__registry["js/ui/screens/standings.js"] = function (__x, __req) {
// Clasificación del campeonato: pilotos, constructores y por rondas.

const { el } = __req("js/ui/dom.js");
const { standingsTable, constructorsTable } = __req("js/ui/screens/tables.js");
const { buildStandings, playerRow, teamRow } = __req("js/game/standings.js");
const { calendarFor } = __req("js/game/career.js");
const { ctx } = __req("js/ui/context.js");

async function showStandings(shell) {
  const state = ctx.career;
  if (!state) return;
  const standings = state.standings || buildStandings(state.series, state.history, state.entryList);
  const me = playerRow(standings, state.driver.id);
  const myTeam = teamRow(standings, state.teamId);
  const rounds = calendarFor(state);
  const played = state.history.length;

  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: 'GP' }),
    el('th.num', { text: 'Acumulado' }),
    el('th.num', { text: 'Victorias' }),
    el('th.num', { text: 'Podios' }),
    el('th.num', { text: 'Poles' }),
    el('th.num', { text: 'Aband.' }),
  ])));
  const body = el('tbody');
  state.history.forEach((h, i) => {
    const partial = buildStandings(state.series, state.history.slice(0, i + 1), state.entryList);
    const row = playerRow(partial, state.driver.id);
    body.append(el('tr', { class: h.round === state.round ? 'me' : '' }, [
      el('td', null, el('div.driver-cell', null, [
        el('span.flag', { text: rounds.find((r) => r.round === h.round)?.flag || '' }),
        el('span.grow', { text: h.gp || `Ronda ${h.round}` }),
      ])),
      el('td.num', { text: `${row?.points ?? 0} (P${row?.position ?? '—'})` }),
      el('td.num', { text: String(row?.wins ?? 0) }),
      el('td.num', { text: String(row?.podiums ?? 0) }),
      el('td.num', { text: String(row?.poles ?? 0) }),
      el('td.num', { text: String(row?.dnfs ?? 0) }),
    ]));
  });
  const history = el('div.table-scroll', null, table);

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `Mundial ${state.series === 'f1' ? 'F1' : 'F2'} 2026` }),
        el('div.sub', { text: `${played} de ${rounds.length} rondas disputadas` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip.chip-red', { text: `P${me?.position ?? '—'}` }),
        el('span.chip', { text: `${me?.points ?? 0} pts` }),
        myTeam ? el('span.chip', { text: `Equipo P${myTeam.position}` }) : null,
      ]),
    ]),
    el('div.grid.grid-side', null, [
      el('div.card', null, [
        el('h3', { text: 'Pilotos' }),
        el('div.table-scroll', null, standingsTable(standings, { playerId: state.driver.id, series: state.series, showTrend: true })),
      ]),
      el('div.stack', null, [
        el('div.card', null, [
          el('h3', { text: 'Constructores' }),
          el('div.table-scroll', null, constructorsTable(standings, { teamId: state.teamId, series: state.series })),
        ]),
        el('div.card', null, [el('h3', { text: 'Tus rondas' }), history]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Clasificación', subtitle: state.series === 'f1' ? 'Fórmula 1' : 'Fórmula 2' });
}

  __x.showStandings = showStandings;
};
__registry["js/ui/screens/tables.js"] = function (__x, __req) {
// Tablas compartidas por clasificación, resultados y calendario.

const { el, formatTime, formatGap } = __req("js/ui/dom.js");
const { getTeam, teamLogo } = __req("js/data/teams.js");
const { TYRES } = __req("js/game/car.js");

const NEUTRAL = '#3a4152';

function teamBar(teamId, series) {
  const team = teamId ? getTeam(teamId, series) : null;
  return el('span.team-bar', { style: { background: team?.livery?.primary || NEUTRAL } });
}

/**
 * Escudo de la escudería en PNG. Si el fichero no existe (o el equipo no tiene
 * escudo) cae a la barrita de color, para que la tabla nunca se rompa.
 */
function teamBadge(teamId, series = 'f1', { size = 20 } = {}) {
  const team = teamId ? getTeam(teamId, series) : null;
  const bar = teamBar(teamId, series);
  const src = team ? teamLogo(team, series) : '';
  const wrap = el('span.team-crest', { title: team ? team.name : '' });
  if (!src) {
    wrap.append(bar);
    return wrap;
  }
  const img = el('img.team-logo', {
    src,
    alt: team.name,
    width: size,
    height: size,
    loading: 'lazy',
    decoding: 'async',
    on: { error: () => { img.remove(); wrap.append(bar); } },
  });
  wrap.append(img);
  return wrap;
}

function statusChip(entry) {
  if (entry.dsq) return el('span.chip.chip-red', { text: 'Descalificado' });
  if (entry.retired) return el('span.chip.chip-amber', { text: entry.retireReason || 'Abandono' });
  if (entry.eliminated) return el('span.chip', { text: `Eliminado en Q${(entry.segment || 0) + 1}` });
  return el('span.chip.chip-green', { text: 'Clasificado' });
}

/** Neumático final y cumplimiento de la parada obligatoria. */
function tyreCell(entry) {
  const t = TYRES[entry.tyre];
  const row = el('div.row.row-tight');
  row.append(el('span.tyre-dot', { style: `background:${t?.color || '#888'}` }));
  row.append(el('span', { text: t ? `${t.name}` : '—' }));
  if (entry.penaltyMs) row.append(el('span.chip.chip-red', { text: `+${entry.penaltyMs / 1000}s` }));
  else if (entry.pitStops) row.append(el('span.chip.chip-green', { text: 'Parada OK' }));
  else row.append(el('span.chip.chip-amber', { text: 'Sin parar' }));
  return row;
}

/** Tabla de clasificación de campeonato. */
function standingsTable(standings, { playerId = 'player', limit = 0, series = 'f1', showTrend = false } = {}) {
  const rows = standings.drivers || [];
  const shown = limit ? rows.slice(0, limit) : rows;
  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: '#' }),
    el('th', { text: 'Piloto' }),
    el('th.num', { text: 'Pts' }),
    el('th.num', { text: 'Vict' }),
    el('th.num', { text: 'Pod' }),
    el('th.num', { text: 'PP' }),
    showTrend ? el('th.num', { text: 'Top10' }) : null,
    el('th.num', { text: 'Aband.' }),
  ].filter(Boolean))));
  const body = el('tbody');
  shown.forEach((d, i) => {
    body.append(el('tr', { class: d.driverId === playerId ? 'me' : '' }, [
      el('td.pos-cell', { text: String(i + 1) }),
      el('td', null, el('div.driver-cell', null, [
        teamBadge(d.teamId, series),
        el('span.flag', { text: d.flag || '🏁' }),
        el('span.grow', { text: d.name }),
        el('span.dim.mono', { style: { fontSize: '11px' }, text: d.short || '' }),
      ])),
      el('td.num', { text: String(d.points) }),
      el('td.num', { text: String(d.wins) }),
      el('td.num', { text: String(d.podiums) }),
      el('td.num', { text: String(d.poles) }),
      showTrend ? el('td.num', { text: String(d.top10) }) : null,
      el('td.num', { class: d.dnfs ? 'neg' : '', text: String(d.dnfs) }),
    ].filter(Boolean)));
  });
  table.append(body);
  if (!rows.length) {
    table.append(el('tbody', null, el('tr', null, el('td', { colspan: '8', class: 'dim', text: 'Todavía no hay resultados.' }))));
  }
  return table;
}

/** Tabla de constructores. */
function constructorsTable(standings, { teamId = null, limit = 0, series = 'f1' } = {}) {
  const rows = standings.teams || [];
  const shown = limit ? rows.slice(0, limit) : rows;
  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: '#' }),
    el('th', { text: 'Escudería' }),
    el('th.num', { text: 'Pts' }),
    el('th.num', { text: 'Vict' }),
  ])));
  const body = el('tbody');
  shown.forEach((t, i) => {
    const team = getTeam(t.teamId, series) || {};
    body.append(el('tr', { class: t.teamId === teamId ? 'me' : '' }, [
      el('td.pos-cell', { text: String(i + 1) }),
      el('td', null, el('div.driver-cell', null, [
        teamBadge(t.teamId, series),
        el('span.flag', { text: team.flag || '' }),
        el('span.grow', { text: team.name || t.teamId }),
      ])),
      el('td.num', { text: String(t.points) }),
      el('td.num', { text: String(t.wins) }),
    ]));
  });
  table.append(body);
  if (!rows.length) {
    table.append(el('tbody', null, el('tr', null, el('td', { colspan: '4', class: 'dim', text: 'Sin equipos todavía.' }))));
  }
  return table;
}

/** Tabla de resultados de una sesión (carrera, sprint, clasificación o libres). */
function resultTable(result, { playerId = 'player', isQuali = false, series = 'f1' } = {}) {
  const entries = result?.entries || [];
  const table = el('table.table');
  table.append(el('thead', null, el('tr', null, [
    el('th', { text: 'P' }),
    el('th', { text: 'Piloto' }),
    el('th.num', { text: isQuali ? 'Mejor vuelta' : 'Diferencia' }),
    el('th.num', { text: isQuali ? 'Q' : 'Par' }),
    el('th.num', { text: 'Vueltas' }),
    isQuali ? null : el('th', { text: 'Neumático' }),
    el('th', { text: 'Estado' }),
  ].filter(Boolean))));
  const body = el('tbody');
  for (const d of entries) {
    const time = isQuali
      ? formatTime(d.bestLapMs)
      : (d.position === 1 && d.gapMs === 0 ? 'Líder' : formatGap(d.gapMs));
    body.append(el('tr', { class: d.driverId === playerId ? 'me' : '' }, [
      el('td.pos-cell', { text: d.position ? String(d.position) : '—' }),
      el('td', null, el('div.driver-cell', null, [
        teamBadge(d.teamId, series),
        el('span.flag', { text: d.flag || '🏁' }),
        el('span.grow', { text: d.name }),
        d.fastestLap ? el('span.chip', { class: 'chip-purple', text: 'VR' }) : null,
      ].filter(Boolean))),
      el('td.num', { text: time }),
      el('td.num', { text: isQuali ? `Q${(d.segment ?? 3) + 1}` : (d.grid ? String(d.grid) : '—') }),
      el('td.num', { text: String(d.laps ?? 0) }),
      isQuali ? null : el('td', null, tyreCell(d)),
      el('td', null, statusChip(d)),
    ].filter(Boolean)));
  }
  table.append(body);
  if (!entries.length) {
    table.append(el('tbody', null, el('tr', null, el('td', { colspan: '6', class: 'dim', text: 'Sin datos de la sesión.' }))));
  }
  return table;
}

/** Tarjeta con la vuelta más rápida de la sesión. */
function fastestLapCard(result, { playerId = 'player' } = {}) {
  if (!result?.fastestLapDriverId) return null;
  const entry = (result.entries || []).find((e) => e.driverId === result.fastestLapDriverId);
  const isMe = result.fastestLapDriverId === playerId;
  return el(`div.card.pad-sm${isMe ? '.accent' : ''}`, null, [
    el('div.eyebrow', { text: 'Vuelta más rápida' }),
    el('div.row.between', null, [
      el('b', { text: `${entry?.flag || ''} ${entry?.name || ''}` }),
      el('b.mono', { text: formatTime(result.fastestLapMs) }),
    ]),
    isMe ? el('div.hint', { text: 'Punto extra en el championship.' }) : null,
  ]);
}

/** Fila de chips con el resumen del jugador. */
function playerSummary(entry, { playerId = 'player' } = {}) {
  if (!entry) return null;
  return el('div.row.row-tight', null, [
    el('span.chip', { text: `P${entry.position ?? '—'}` }),
    el('span.chip', { text: `Par ${entry.grid || '—'}` }),
    el('span.chip', { text: `Mejor ${formatTime(entry.bestLapMs)}` }),
    el('span.chip', { text: `${entry.laps ?? 0} vueltas` }),
    entry.pitStops ? el('span.chip', { text: `${entry.pitStops} parada(s)` }) : null,
    entry.penaltyMs ? el('span.chip.chip-red', { text: `+${entry.penaltyMs / 1000}s de penalización` }) : null,
  ]);
}

  __x.teamBadge = teamBadge;
  __x.standingsTable = standingsTable;
  __x.constructorsTable = constructorsTable;
  __x.resultTable = resultTable;
  __x.fastestLapCard = fastestLapCard;
  __x.playerSummary = playerSummary;
};
__registry["js/ui/screens/weekend.js"] = function (__x, __req) {
// Fin de semana: programa de la ronda con acceso a cada sesión y datos del circuito.

const { el, button } = __req("js/ui/dom.js");
const { currentRound, calendarFor, daysToRound } = __req("js/game/career.js");
const { weekendLabel } = __req("js/data/calendar.js");
const { ctx, canRun } = __req("js/ui/context.js");
const { simulateRound } = __req("js/ui/sim.js");

async function showWeekend(shell) {
  const state = ctx.career;
  if (!state) return;
  const round = currentRound(state);
  if (!round) {
    const { showPaddock } = await __lazy("js/ui/screens/paddock.js");
    return showPaddock(shell, {});
  }
  const circuit = round.circuit;
  const required = round.sessions.filter((s) => s.required);
  const done = required.filter((s) => s.played).length;

  const list = el('div.week', null, round.sessions.map((def) => {
    const runnable = canRun(def, round);
    const isNext = required.find((s) => !s.played)?.id === def.id;
    const me = def.result?.entries?.find((e) => e.driverId === state.driver.id);
    return el('button.session-row', {
      class: `${def.played ? 'played' : ''} ${isNext ? 'next' : ''}`,
      type: 'button',
      disabled: def.played || !runnable,
      on: {
        click: async () => {
          const { showSession } = await __lazy("js/ui/screens/session.js");
          await showSession(shell, { session: def, round });
        },
      },
    }, [
      el('div', { style: { width: '58px' } }, [
        el('div.when', { text: DAY[def.day] || def.day }),
        el('div.state', { text: `${def.minutes} min` }),
      ]),
      el('div.grow', null, [
        el('div.what', { text: def.name }),
        el('div.state', { text: def.result
          ? (def.result.kind === 'quali' ? `Parrilla P${me?.grid ?? '—'}` : `P${me?.position ?? '—'}`)
          : def.required ? 'Sesión obligatoria' : 'Sesión opcional' }),
      ]),
      el('span.chip', {
        class: def.played ? 'chip-green' : isNext ? 'chip-red' : '',
        text: def.played ? 'Completada' : isNext ? 'Siguiente' : runnable ? 'Disponible' : 'Bloqueada',
      }),
    ]);
  }));

  shell.mount(el('div.screen', null, [
    el('div.screen-head', null, [
      el('div', null, [
        el('h2', { text: `${round.flag} ${round.gp}` }),
        el('div.sub', { text: `${circuit.name} · ${weekendLabel(round)} · ${daysToRound(state)} días` }),
      ]),
      el('div.row.row-tight', null, [
        el('span.chip', { text: `${done}/${required.length} obligatorias` }),
        button('Simular ronda', {
          kind: 'ghost',
          title: 'Simula todas las sesiones de la ronda, incluida la obligatoria',
          onClick: async () => {
            simulateRound(ctx, shell);
            await showWeekend(shell);
          },
        }),
      ]),
    ]),
    el('div.grid.grid-side', null, [
      el('div.card', null, [el('h3', { text: 'Programa' }), list]),
      el('div.stack', null, [
        el('div.card.accent', null, [
          el('h3', { text: 'Datos del circuito' }),
          el('dl.kv', null, [
            el('dt', { text: 'Longitud' }), el('dd', { text: `${circuit.length} km` }),
            el('dt', { text: 'Vueltas' }), el('dd', { text: String(circuit.laps) }),
            el('dt', { text: 'Ancho' }), el('dd', { text: `${circuit.width} m` }),
            el('dt', { text: 'Clima' }), el('dd', { text: circuit.weather }),
            el('dt', { text: 'Récord' }), el('dd', { text: circuit.record || '—' }),
            el('dt', { text: 'Curvas' }), el('dd', { text: String(circuit.corners?.length || 0) }),
          ]),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Claves del circuito' }),
          el('div.hint', { text: 'Repite la zona de DRS y el sector 2 es donde se decide la clasificación.' }),
        ]),
        el('div.card', null, [
          el('h3', { text: 'Temporada' }),
          el('div.hint', { text: `Ronda ${state.round} de ${calendarFor(state).length}. ${
            round.sprint || state.series === 'f2' ? 'Fin de semana con carrera Sprint.' : 'Fin de semana sin Sprint.'
          }` }),
        ]),
      ]),
    ]),
  ]));

  shell.setChrome({ title: 'Fin de semana', subtitle: `${round.flag} ${round.gp}` });
}

const DAY = { thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom' };

  __x.showWeekend = showWeekend;
};
__registry["js/ui/shell.js"] = function (__x, __req) {
// Shell de la aplicación: barra superior con navegación por pestañas,
// pila de pantallas, avisos emergentes y modales.

const { el, clear, button } = __req("js/ui/dom.js");

class Shell {
  /**
   * @param {{appbar: HTMLElement, body: HTMLElement, toasts: HTMLElement, modalRoot: HTMLElement}} nodes
   */
  constructor(nodes) {
    this.appbar = nodes.appbar;
    this.body = nodes.body;
    this.toasts = nodes.toasts;
    this.modalRoot = nodes.modalRoot;
    this.stack = [];
    this.current = null;
    this.activeId = null;
    this.modalStack = [];
    this.navItems = [];
    this.onNavigate = null;
  }

  /** Define las pestañas de la barra superior. */
  setNav(items) {
    this.navItems = items;
    this.renderNav();
  }

  /** Marca la pestaña activa. */
  setActive(id) {
    this.activeId = id;
    this.renderNav();
  }

  renderNav() {
    if (!this.navHost) return;
    this.navHost.textContent = '';
    for (const item of this.navItems) {
      this.navHost.append(button(item.label, {
        kind: 'ghost',
        small: true,
        pressed: this.activeId === item.id,
        title: item.title || item.label,
        onClick: () => this.onNavigate?.(item.id),
      }));
    }
  }

  setChrome({ title, subtitle, chips = [] }) {
    clear(this.appbar);
    const back = this.stack.length > 1
      ? button('‹', { kind: 'ghost', title: 'Volver', onClick: () => this.back() })
      : null;
    const nav = el('div.chips');
    this.navHost = nav;
    this.renderNav();
    this.appbar.append(
      back,
      el('div.title', null, [el('b', { text: title }), el('span', { text: subtitle })]),
      el('div.spacer'),
      ...chips.map((chip) => (typeof chip === 'string'
        ? el('span.chip', { text: chip })
        : el('span.chip', { class: chip.kind || '' }, chip.label))),
      nav,
    );
  }

  /** Muestra una pantalla. Cada pantalla recibe (shell, params). */
  async show(screen, params = {}) {
    const previous = this.current;
    if (screen.keepAlive !== false && previous) this.stack.push(previous);
    this.current = screen;
    await screen.render?.(this, params);
    if (screen.title !== undefined) {
      this.setChrome({
        title: typeof screen.title === 'function' ? screen.title(params) : screen.title,
        subtitle: screen.subtitle ? (typeof screen.subtitle === 'function' ? screen.subtitle(params) : screen.subtitle) : '',
        chips: screen.chips ? (typeof screen.chips === 'function' ? screen.chips(params) : screen.chips) : [],
      });
    }
  }

  /** Reemplaza la pantalla actual sin apilar. */
  async replace(screen, params = {}) {
    this.current = screen;
    await screen.render?.(this, params);
  }

  back() {
    const prev = this.stack.pop();
    if (!prev) return false;
    this.current = prev;
    prev.render?.(this, {});
    if (prev.title !== undefined) {
      this.setChrome({
        title: typeof prev.title === 'function' ? prev.title({}) : prev.title,
        subtitle: prev.subtitle ? (typeof prev.subtitle === 'function' ? prev.subtitle({}) : prev.subtitle) : '',
        chips: prev.chips ? (typeof prev.chips === 'function' ? prev.chips({}) : prev.chips) : [],
      });
    }
    return true;
  }

  get host() {
    return this.body;
  }

  /** Limpia el cuerpo antes de montar una pantalla. */
  mount(...children) {
    clear(this.body);
    this.body.append(...children);
  }

  toast(text, kind = '') {
    const node = el(`div.toast${kind ? `.${kind}` : ''}`, { text });
    this.toasts.append(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 260);
    }, kind === 'bad' ? 4200 : 3000);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  /** Abre un modal. Devuelve una promesa con el valor de `close`. */
  modal({ title, body, actions = [], dismissable = true, onClose }) {
    return new Promise((resolve) => {
      const close = (value) => {
        this.modalStack = this.modalStack.filter((m) => m !== entry);
        if (!this.modalStack.length) {
          clear(this.modalRoot);
          this.modalRoot.hidden = true;
        }
        onClose?.(value);
        resolve(value);
      };
      const entry = { close };
      this.modalStack.push(entry);
      const panel = el('div.modal', { role: 'dialog', 'aria-modal': 'true' }, [
        title ? el('h3', { text: title }) : null,
        body ? el('div.modal-body', null, body) : null,
        actions.length
          ? el('div.actions', null, actions.map((a) => button(a.label, {
            kind: a.kind || 'ghost',
            onClick: () => close(a.value ?? a.label),
          })))
          : null,
      ]);
      clear(this.modalRoot);
      this.modalRoot.append(panel);
      this.modalRoot.hidden = false;
      this.modalRoot.onclick = (e) => { if (dismissable && e.target === this.modalRoot) close(null); };
      const first = panel.querySelector('button');
      /* En entornos sin soporte de foco (pruebas, DOM simulado) no debe fallar */
      if (first && typeof first.focus === 'function') first.focus();
    });
  }

  closeAllModals() {
    for (const entry of [...this.modalStack]) entry.close(null);
  }
}

  __x.Shell = Shell;
};
__registry["js/ui/sim.js"] = function (__x, __req) {
// Simulación de sesiones que el jugador no quiere conducir: rellena los
// libres y, opcionalmente, adelanta al siguiente bloque con resultados
// coherentes generados a partir del rendimiento del coche y del rival.

const { createSession, updateSession } = __req("js/game/race.js");
const { getCircuit } = __req("js/data/circuits.js");
const { recordSession, currentRound, advanceToNextRound, roundFinished, gridEntryList } = __req("js/game/career.js");
const { ctx } = __req("js/ui/context.js");
const { autosave } = __req("js/ui/save.js");

/**
 * Simula una sesión completa sin renderizado.
 * @returns {object|null} resultado de la sesión
 */
function simulateSession(state, round, sessionDef) {
  const session = createSession({
    circuit: getCircuit(round.circuitId),
    entryList: gridEntryList(state),
    kind: sessionDef.type,
    round,
    settings: ctx.settings,
    seed: `${state.seed}|${state.series}|${state.round}|${sessionDef.id}`,
  });
  const dt = 1 / 20;
  let guard = 0;
  while (!session.completed && guard < 240000) {
    updateSession(session, dt, { steer: 0, throttle: 1, brake: 0, handbrake: false, drsPressed: false, pitPressed: false });
    guard++;
  }
  if (!session.completed) return null;
  return session.results;
}

/**
 * Rellena todas las sesiones pendientes de la ronda actual hasta la siguiente
 * obligatoria incluida. Útil para «simular hasta la clasificación».
 */
function simulateRest(context = ctx, shell = null) {
  const state = context.career;
  if (!state) return 0;
  const round = currentRound(state);
  if (!round) return 0;
  const target = round.sessions.find((s) => s.required && !s.played);
  if (!target) return 0;
  let done = 0;
  for (const def of round.sessions) {
    if (def.played) continue;
    if (def.required && def.id !== target.id) break;
    const results = simulateSession(state, round, def);
    if (!results) break;
    recordSession(state, { ...results, kind: def.type, round: state.round, sessionId: def.id });
    done++;
    if (def.id === target.id) break;
  }
  if (roundFinished(state)) advanceToNextRound(state);
  autosave();
  shell?.toast(`${done} sesión(es) simulada(s).`, 'good');
  return done;
}

/** Adelanta toda una ronda (todas las sesiones, incluida la obligatoria). */
function simulateRound(context = ctx, shell = null) {
  const state = context.career;
  if (!state) return 0;
  const round = currentRound(state);
  if (!round) return 0;
  let done = 0;
  for (const def of round.sessions) {
    if (def.played) continue;
    const results = simulateSession(state, round, def);
    if (!results) break;
    recordSession(state, { ...results, kind: def.type, round: state.round, sessionId: def.id });
    done++;
  }
  if (roundFinished(state)) advanceToNextRound(state);
  autosave();
  shell?.toast(`Ronda completa simulada (${done} sesiones).`, 'good');
  return done;
}

  __x.simulateSession = simulateSession;
  __x.simulateRest = simulateRest;
  __x.simulateRound = simulateRound;
};
__registry["js/ui/tips.js"] = function (__x, __req) {
// Consejos que se muestran durante la carga.

const TIPS = [
  'El DRS solo se abre en las zonas marcadas del circuito: busca el tramo verde antes de la frenada.',
  'Frenar tarde da más tiempo total: la trazada ideal se calcula con el frenado al límite.',
  'Los neumáticos C5 blandos dan más agarre, pero se degradan antes que los C2 duros.',
  'El ERS se carga frenando y se descarga en las rectas. Úsalo para defenderse en la recta de meta.',
  'Si acumulas daño sin pasar por boxes, el coche se acabará parando.',
  'La clasificación decide la parrilla: un hueco en Q3 puede valer más que una décima por vuelta.',
  'El coche de seguridad neutraliza la carrera: mantén la distancia y no intentes ganar posiciones.',
  'Los sprints puntúan, pero suelen ser más caóticos que la carrera principal.',
  'Repetir la temporada mejora el coche y conserva tus estadísticas en F2.',
  'El ERS del motor se recupera en las zonas de frenada y se gasta en las rectas.',
  'Salir limpio en las cinco luces vale más que arrancar con agresividad y romper el tren de atrás.',
  'Los entrenamientos son opcionales, pero simularlos da datos para afinar la estrategia.',
  'Cambia de cámara con la tecla C cuando quieras ver el margen de pista.',
  'En el paddock, el correo del jefe de equipo marca los objetivos de la temporada.',
  'Guarda con Exportar: el archivo se puede recuperar en otro dispositivo.',
  'En móvil aparecen los mandos táctiles; también vale con un mando.',
];

function randomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

  __x.TIPS = TIPS;
  __x.randomTip = randomTip;
};
__req("js/main.js");
})();