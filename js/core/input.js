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

export const input = new InputManager();
