/**
 * input.js — unified input: keyboard, Gamepad API and touch.
 * Produces a normalised control object consumed by the vehicle physics,
 * plus an event bus for discrete actions (pit, camera, pause, recover...).
 */

import { clamp, approach } from "./utils.js";

const KEYMAP = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  handbrake: ["Space"],
};

const ACTION_KEYS = {
  pit: ["KeyP"],
  recover: ["KeyR"],
  camera: ["KeyC"],
  pause: ["Escape", "Tab"],
  lights: ["KeyL"],
  restart: ["KeyF5"],
};

export class InputManager {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.touch = { steer: 0, throttle: 0, brake: 0, active: false };
    this.gamepadIndex = null;
    this.hasGamepad = false;
    this.enabled = true;
    this._listeners = new Map();
    this._steerSmooth = 0;
    this._prev = { steer: 0, throttle: 0, brake: 0 };
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onGamepad = this._onGamepad.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }

  attach() {
    this.target.addEventListener("keydown", this._onKeyDown);
    this.target.addEventListener("keyup", this._onKeyUp);
    this.target.addEventListener("blur", this._onBlur);
    this.target.addEventListener("gamepadconnected", this._onGamepad);
    this.target.addEventListener("gamepaddisconnected", this._onGamepad);
    this._syncGamepads();
    this._installTouch();
    return this;
  }

  detach() {
    this.target.removeEventListener("keydown", this._onKeyDown);
    this.target.removeEventListener("keyup", this._onKeyUp);
    this.target.removeEventListener("blur", this._onBlur);
    this.target.removeEventListener("gamepadconnected", this._onGamepad);
    this.target.removeEventListener("gamepaddisconnected", this._onGamepad);
  }

  /* ----------------------------- events ----------------------------- */
  on(action, fn) {
    if (!this._listeners.has(action)) this._listeners.set(action, new Set());
    this._listeners.get(action).add(fn);
    return () => this.off(action, fn);
  }

  off(action, fn) {
    this._listeners.get(action)?.delete(fn);
  }

  emit(action, payload) {
    this._listeners.get(action)?.forEach((fn) => fn(payload));
  }

  /* ---------------------------- keyboard ---------------------------- */
  _onKeyDown(e) {
    if (!this.enabled) return;
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.repeat) return;
    const code = e.code;
    this.keys.add(code);
    for (const [action, codes] of Object.entries(ACTION_KEYS)) {
      if (codes.includes(code)) {
        this.emit(action);
        if (code === "Space" || code === "Tab" || code.startsWith("Arrow") || code === "F5") e.preventDefault();
      }
    }
    if (/^Digit[1-4]$/.test(code)) this.emit("simspeed", Number(code.slice(5)));
    this.emit("anykey", code);
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onBlur() {
    this.keys.clear();
    this.touch.steer = this.touch.throttle = this.touch.brake = 0;
    this.emit("blur");
  }

  down(action) {
    return KEYMAP[action].some((k) => this.keys.has(k));
  }

  /* ---------------------------- gamepad ---------------------------- */
  _syncGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let found = null;
    for (const p of pads) if (p && p.connected) { found = p; break; }
    this.gamepadIndex = found ? found.index : null;
    this.hasGamepad = !!found;
  }

  _onGamepad(e) {
    this._syncGamepads();
    this.emit("gamepad", this.hasGamepad);
  }

  _pollGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    let pad = this.gamepadIndex != null ? pads[this.gamepadIndex] : null;
    if (!pad || !pad.connected) {
      this._syncGamepads();
      pad = this.gamepadIndex != null ? pads[this.gamepadIndex] : null;
    }
    if (!pad) return null;
    const ax = pad.axes[0] ?? 0;
    const rt = pad.buttons[7]?.value ?? 0;
    const lt = pad.buttons[6]?.value ?? 0;
    const dead = 0.14;
    let steer = Math.abs(ax) < dead ? 0 : (ax - Math.sign(ax) * dead) / (1 - dead);
    // D-pad fallback steering
    const dpx = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
    if (dpx !== 0) steer = dpx;
    return {
      steer, throttle: rt, brake: lt,
      handbrake: !!(pad.buttons[0]?.pressed),
      pit: !!(pad.buttons[2]?.pressed),
      recover: !!(pad.buttons[3]?.pressed),
      camera: !!(pad.buttons[5]?.pressed),
      pause: !!(pad.buttons[9]?.pressed),
      any: pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a) > dead),
    };
  }

  /* ----------------------------- touch ----------------------------- */
  _installTouch() {
    const supportsTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!supportsTouch) return;
    this.touchSupported = true;
  }

  bindTouchZones(zones) {
    // zones: { steer, throttle, brake } DOM elements
    this.touchZones = zones;
    this.touch.active = true;
    const handlers = (el, key) => {
      if (!el) return;
      const onStart = (e) => {
        e.preventDefault();
        el.dataset.active = "1";
        this._touchKeys = this._touchKeys || new Set();
        this._touchKeys.add(key);
        this._updateTouch();
      };
      const onEnd = (e) => {
        e.preventDefault();
        el.dataset.active = "";
        this._touchKeys?.delete(key);
        this._updateTouch();
      };
      el.addEventListener("pointerdown", onStart);
      el.addEventListener("pointerup", onEnd);
      el.addEventListener("pointercancel", onEnd);
      el.addEventListener("pointerleave", onEnd);
    };
    handlers(zones.steer, "steerZone");
    handlers(zones.throttle, "throttle");
    handlers(zones.brake, "brake");
  }

  _updateTouch() {
    const keys = this._touchKeys || new Set();
    const zone = zonesRect(this.touchZones?.steer);
    let steer = 0, throttle = 0, brake = 0;
    if (zone && this._activeSteerId != null && this._steerOrigin != null) {
      const dx = (this._activeSteerX - this._steerOrigin) / (zone.width * 0.42);
      steer = clamp(dx, -1, 1);
    }
    if (keys.has("throttle")) throttle = 1;
    if (keys.has("brake")) brake = 1;
    this.touch.steer = steer;
    this.touch.throttle = throttle;
    this.touch.brake = brake;
  }

  /* ------------------------------ api ------------------------------ */
  /** Poll all sources and return smoothed driving controls. */
  sample(dt) {
    const pad = this.hasGamepad ? this._pollGamepad() : null;
    let steerTarget = 0, throttle = 0, brake = 0, handbrake = 0;

    if (this.down("left")) steerTarget -= 1;
    if (this.down("right")) steerTarget += 1;
    if (this.down("throttle")) throttle = 1;
    if (this.down("brake")) brake = 1;
    if (this.down("handbrake")) handbrake = 1;

    if (pad) {
      if (Math.abs(pad.steer) > 0.02) steerTarget = pad.steer;
      throttle = Math.max(throttle, pad.throttle);
      brake = Math.max(brake, pad.brake);
      handbrake = Math.max(handbrake, pad.handbrake ? 1 : 0);
      if (pad.any && !this._padAnyPrev) this._padEdge("anykey");
      this._padAnyPrev = pad.any;
    }

    if (this.touch.active) {
      if (Math.abs(this.touch.steer) > 0.02) steerTarget = this.touch.steer;
      throttle = Math.max(throttle, this.touch.throttle);
      brake = Math.max(brake, this.touch.brake);
    }

    // Smooth steering so keyboard input is not a square wave.
    const rate = Math.abs(steerTarget) < 0.01 ? 6.5 : 4.6;
    this._steerSmooth = approach(this._steerSmooth, steerTarget, rate * dt);

    return {
      steer: clamp(this._steerSmooth, -1, 1),
      throttle: clamp01v(throttle),
      brake: clamp01v(brake),
      handbrake,
    };
  }

  _padEdge(action) { this.emit(action); }

  reset() {
    this.keys.clear();
    this._steerSmooth = 0;
    this.touch.steer = this.touch.throttle = this.touch.brake = 0;
  }
}

const clamp01v = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function zonesRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, width: r.width, top: r.top, height: r.height };
}

/** Wire pointer steering on a container element (drag anywhere in it). */
export function bindSteerSurface(el, input) {
  let id = null, originX = 0;
  el.addEventListener("pointerdown", (e) => {
    id = e.pointerId; originX = e.clientX;
    input._activeSteerId = id; input._steerOrigin = originX; input._activeSteerX = e.clientX;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    input._activeSteerX = e.clientX;
    input._updateTouch();
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    input._activeSteerId = null; input._steerOrigin = null;
    input.touch.steer = 0;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", end);
}
