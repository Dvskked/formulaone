/**
 * session.js — shared simulation core.
 *
 * Owns the vehicle list, the fixed-step physics loop, AI, collisions,
 * surface detection, barriers, lap/sector timing, live positions and the
 * event log. Race and qualifying sessions extend this with their own rules.
 *
 * Deliberately free of any DOM reference so it can run headless (tests,
 * career simulation) as well as inside the game loop.
 */

import { clamp, clamp01 } from "../core/utils.js";
import { makeRng } from "../core/rng.js";
import { Vehicle, bindTrack } from "./vehicle.js";
import { AIController, makeAIProfile } from "./ai.js";
import { ageTyre } from "./tires.js";

export const FIXED_DT = 1 / 120;
const MAX_STEPS = 18;
const CAR_RADIUS = 2.6;
const RUNOFF = 12;

export const SESSION_STATE = {
  FORMATION: "formation",
  COUNTDOWN: "countdown",
  GREEN: "green",
  PAUSED: "paused",
  FINISHED: "finished",
};

export class Session {
  /**
   * @param {object} opts
   *   track      – Track instance
   *   entries    – [{ team, driver, isPlayer, spec? }]
   *   type       – 'race' | 'qualifying' | 'practice'
   *   laps       – race distance in laps
   *   seed       – integer RNG seed
   *   assists    – driver aid flags
   *   countdown  – seconds of formation before the lights (race only)
   */
  constructor(opts) {
    this.track = opts.track;
    this.type = opts.type || "race";
    this.laps = opts.laps ?? 6;
    this.seed = opts.seed ?? 12345;
    this.rng = makeRng(this.seed);
    this.assists = opts.assists || {};
    this.duration = opts.duration ?? 0;      // qualifying / practice window (s)
    this.cars = [];
    this.controllers = new Map();
    this.messages = [];
    this.time = 0;
    this.accumulator = 0;
    this.state = SESSION_STATE.FORMATION;
    this.countdown = opts.countdown ?? 0;
    this.countdownStep = 0;
    this.simSpeed = 1;
    this.paused = false;
    this.finishedAt = null;
    this.safetyCar = false;
    this._tmpList = [];
    this._events = [];
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                                */
  /* ------------------------------------------------------------------ */

  addEntry({ team, driver, spec, isPlayer = false, gridSlot = 0, compound = "soft", fuel = 0, profile = null }) {
    const v = new Vehicle({
      driver, team, spec, isPlayer,
      assists: this.assists,
      compound, fuel,
      track: this.track,
      rng: this.rng,
    });
    v.gridSlot = gridSlot;
    v._spec = spec;
    this.cars.push(v);
    if (!isPlayer) {
      const ctrl = new AIController(v, this.track, makeAIProfile(driver, spec, this.rng, profile || {}));
      this.controllers.set(v.id, ctrl);
    }
    return v;
  }

  finalise() {
    bindTrack(this.cars, this.track);
    for (const v of this.cars) {
      v.lapStartTime = 0;
      v.lastSectorTime = 0;
      v.position = v.gridSlot + 1;
    }
    this.player = this.cars.find((c) => c.isPlayer) || null;
    return this;
  }

  get ordered() {
    return this.cars;
  }

  /* ------------------------------------------------------------------ */
  /* Main loop                                                            */
  /* ------------------------------------------------------------------ */

  update(dt, playerInput = null) {
    if (this.paused || this.state === SESSION_STATE.FINISHED) return;
    const scaled = clamp(dt, 0, 0.05) * this.simSpeed;
    this.accumulator += scaled;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      this.step(FIXED_DT, playerInput);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_STEPS) this.accumulator = 0;
  }

  /** One fixed simulation step. */
  step(dt, playerInput) {
    this.time += dt;

    if (this.state === SESSION_STATE.COUNTDOWN) {
      const before = this.countdown;
      this.countdown -= dt;
      this.countdownStep = Math.max(0, 5 - Math.ceil(this.countdown));
      if (before > 0 && this.countdown <= 0) this._goGreen();
      this._stepCars(dt, playerInput, true);
      return;
    }

    this._stepCars(dt, playerInput, false);
    this._resolveCollisions();
    this._updatePositions();
    this._checkEndConditions();
  }

  _goGreen() {
    this.state = SESSION_STATE.GREEN;
    this.countdown = 0;
    this.pushMessage("Lights out — green flag!", "good");
  }

  _stepCars(dt, playerInput, frozen) {
    const world = { cars: this.cars, time: this.time, state: this.state };
    for (const v of this.cars) {
      if (v.isPlayer) {
        if (playerInput) v.desiredControls = { ...playerInput, handbrake: !!playerInput.handbrake };
        if (frozen) v.desiredControls = { throttle: 0, brake: 1, steer: 0, handbrake: true };
      } else {
        const ctrl = this.controllers.get(v.id);
        if (ctrl) ctrl.update(dt, world);
        if (frozen) v.desiredControls = { throttle: 0, brake: 1, steer: 0, handbrake: true };
      }

      const prevOdo = v.odo;
      const prevS = v.s;
      const prevLap = v.lapsDone;

      v.stepPhysics(dt, this.track, this._surfaceFor(v));
      v.syncTrack(this.track);
      this._applyBarriers(v);

      this._updateTiming(v, prevOdo, prevS, prevLap, dt);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Environment                                                         */
  /* ------------------------------------------------------------------ */

  _surfaceFor(v) {
    const hw = this.track.halfWidth[v.trackIndex];
    const a = Math.abs(v.lateral);
    if (a <= hw) return "asphalt";
    if (a <= hw + 1.4) return "kerb";
    if (a <= hw + RUNOFF) return "grass";
    return "gravel";
  }

  /** Keep cars inside the barriers and enforce the pit wall. */
  _applyBarriers(v) {
    const track = this.track;
    const i = v.trackIndex;
    const hw = track.halfWidth[i];
    const inPit = track.inPitWindow(v.s);
    const outer = inPit ? hw + track.pit.offset + track.pit.width / 2 : hw + RUNOFF;
    const halfCar = 1.0;

    if (Math.abs(v.lateral) > outer) {
      const side = sign(v.lateral);
      const p = track.pointAt(v.s, side * (outer - halfCar));
      const impact = Math.abs(v.vx * -Math.sin(v.heading) + v.vy * Math.cos(v.heading));
      v.x = p.x; v.y = p.y;
      const nx = -side * track.nx[i], ny = -side * track.ny[i];
      const vn = v.vx * nx + v.vy * ny;
      if (vn < 0) {
        v.vx -= nx * vn * 1.4;
        v.vy -= ny * vn * 1.4;
      }
      v.vx *= 0.86; v.vy *= 0.86;
      if (impact > 6) {
        v.damage = clamp01(v.damage + impact * 0.0055);
        v.impactFlash = 1;
        v.lastImpact = impact;
        this.pushMessage(`${v.driver.short} hits the barrier`, "bad", v);
      }
      v.lateral = side * (outer - halfCar);
    }

    // Pit wall: the only walled part of the lane is the box complex, so cars
    // (and the player) can cross over anywhere in the entry/exit transition.
    if (inPit) {
      const p = track.pit;
      if (track.inPitWall(v.s)) {
        if (v.lateral > hw - halfCar && v.lateral < hw + 1.4) {
          // Sitting inside the wall — push back to the track side.
          v.lateral = hw - halfCar;
          const pt = track.pointAt(v.s, v.lateral);
          v.x = pt.x; v.y = pt.y;
          const nx = track.nx[i], ny = track.ny[i];
          const vn = v.vx * nx + v.vy * ny;
          if (vn > 0) { v.vx -= nx * vn * 1.5; v.vy -= ny * vn * 1.5; }
        }
      } else if (v.lateral > hw - halfCar && v.lateral < hw + 1.4) {
        // Free transition zone: allow crossing, but only slowly.
        v.lateral = hw + 1.4;
        const pt = track.pointAt(v.s, v.lateral);
        v.x = pt.x; v.y = pt.y;
        const nx = track.nx[i], ny = track.ny[i];
        const vn = v.vx * nx + v.vy * ny;
        if (vn > 0) { v.vx -= nx * vn * 0.5; v.vy -= ny * vn * 0.5; }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Collisions                                                          */
  /* ------------------------------------------------------------------ */

  _resolveCollisions() {
    const cars = this.cars;
    const minDist = CAR_RADIUS * 2;
    for (let a = 0; a < cars.length; a++) {
      const A = cars[a];
      for (let b = a + 1; b < cars.length; b++) {
        const B = cars[b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > minDist * minDist || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = minDist - d;

        const mA = A.spec.mass, mB = B.spec.mass;
        const total = mA + mB;
        A.x -= nx * overlap * (mB / total);
        A.y -= ny * overlap * (mB / total);
        B.x += nx * overlap * (mA / total);
        B.y += ny * overlap * (mA / total);

        const rvx = B.vx - A.vx, rvy = B.vy - A.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn > 0) continue;
        const e = 0.22;
        const j = (-(1 + e) * vn) / (1 / mA + 1 / mB);
        A.vx -= (j * nx) / mA; A.vy -= (j * ny) / mA;
        B.vx += (j * nx) / mB; B.vy += (j * ny) / mB;

        const severity = Math.abs(vn);
        if (severity > 3) {
          A.damage = clamp01(A.damage + severity * 0.0022);
          B.damage = clamp01(B.damage + severity * 0.0022);
          A.impactFlash = B.impactFlash = clamp01(severity / 12);
          A.lastImpact = B.lastImpact = severity;
          this._onContact(A, B, severity);
        }
      }
    }
  }

  _onContact(a, b, severity) {
    if (a.isPlayer || b.isPlayer) {
      const other = a.isPlayer ? b : a;
      this.pushMessage(
        `Contact with ${other.driver.short}${severity > 9 ? " — heavy!" : ""}`,
        severity > 9 ? "bad" : "info", a.isPlayer ? a : b
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* Timing & classification                                             */
  /* ------------------------------------------------------------------ */

  _updateTiming(v, prevOdo, prevS, prevLap, dt) {
    if (v.retired || v.finished) return;
    const track = this.track;
    const lap = v.lapsDone;

    // Sector lines.
    for (let i = 1; i < 3; i++) {
      const line = track.sectorS[i];
      const dLine = track.delta(prevS, line);
      const dNow = track.delta(prevS, v.s);
      if (dLine > 0 && dLine <= dNow && Math.abs(dNow) < 40) {
        this._recordSector(v, i - 1);
      }
    }

    if (lap > prevLap) {
      const lapTime = this.time - v.lapStartTime;
      // lap 1 is only the run from the grid to the line, so it is not timed.
      if (lap > 1 && lapTime > 5) {
        v.lastLapTime = lapTime;
        v.lapTimes.push(lapTime);
        if (v.bestLapTime == null || lapTime < v.bestLapTime) v.bestLapTime = lapTime;
        this._recordSector(v, 2);
        this.onLapComplete(v, lap, lapTime);
      }
      v.lapStartTime = this.time;
      v.lap = lap;
      v.lapsSinceLastEvent = 0;
      ageTyre(v.tire, { track, load: v.tire.lastLapLoad ?? 1, skill: v.driver.stats.tyres / 100 });
    }
  }

  _recordSector(v, index) {
    const split = this.time - (v.lastSectorTime ?? 0);
    v.sectorTimes[index] = split;
    v.lastSectorTime = this.time;
    const best = v.bestSectors[index];
    const isPurple = best == null || split < best;
    v.lastSectorDelta[index] = best == null ? null : split - best;
    if (isPurple) {
      v.bestSectors[index] = split;
      v.purpleSectors = v.purpleSectors || [false, false, false];
      v.purpleSectors[index] = true;
      if (v.isPlayer) this.onSector(v, index, split);
    }
  }

  onSector() {}
  onLapComplete() {}
  onRetire() {}
  onFinish() {}

  _updatePositions() {
    const order = this.cars;
    order.sort(this._cmpProgress);
    for (let i = 0; i < order.length; i++) {
      const v = order[i];
      const np = i + 1;
      if (v.position !== np) {
        v.gain = v.position - np;
        v.position = np;
      }
      if (v.isPlayer) this._computeIntervals(order, i);
    }
  }

  _cmpProgress(a, b) {
    if (a.retired !== b.retired) return a.retired ? 1 : -1;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    return b.odo - a.odo;
  }

  _computeIntervals(order, playerIndex) {
    const p = this.player;
    if (!p) return;
    for (let i = 0; i < order.length; i++) {
      const v = order[i];
      if (i === 0) { v.interval = 0; continue; }
      const ahead = order[i - 1];
      v.interval = (ahead.odo - v.odo) / Math.max(8, v.speed || 20);
    }
    if (playerIndex < 0) p.interval = 0;
  }

  _checkEndConditions() {}

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  pushMessage(text, kind = "info", vehicle = null) {
    const msg = { text, kind, t: this.time, vehicle: vehicle?.id ?? null };
    this.messages.push(msg);
    this._events.push(msg);
    if (this._events.length > 40) this._events.shift();
    return msg;
  }

  /** Drain one-shot events (used by the HUD feed). */
  drainEvents() {
    const e = this._events;
    this._events = [];
    return e;
  }

  /* ------------------------------------------------------------------ */
  /* Queries                                                             */
  /* ------------------------------------------------------------------ */

  get leader() {
    return this.cars[0];
  }

  get running() {
    return this.state === SESSION_STATE.GREEN || this.state === SESSION_STATE.COUNTDOWN;
  }

  /** How many laps the leader has completed. */
  get raceLap() {
    return Math.max(0, ...this.cars.map((c) => c.lapsDone));
  }

  gridOrder() {
    return this.cars.slice().sort((a, b) => a.gridSlot - b.gridSlot);
  }
}

const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
