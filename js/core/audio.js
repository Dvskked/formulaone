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
      intakeFilter,
      intakeGain,
      ers,
      ersFilter,
      ersGain,
      wind,
      windFilter,
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
    const n = this.nodes;
    if (!this.ready || !this.engineOn || !n || n.dead) return;
    /* Si faltara algun nodo, el motor se apaga en vez de reventar el bucle de
       juego: el sonido no puede dejar la pantalla en negro. */
    if (!n.oscA || !n.body || !n.intakeFilter || !n.windFilter || !n.ers) {
      console.warn('Audio: faltan nodos del motor, se desactiva.');
      this.stopEngine();
      return;
    }
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

export const audio = new AudioEngine();

export function audioBoot() {
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
