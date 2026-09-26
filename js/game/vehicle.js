/**
 * vehicle.js — a single car in a session (player or AI).
 * Owns its physical state, tyre/fuel state, session timing and pit state.
 * All simulation logic lives in session.js / race-engine.js; this file is
 * mostly state plus a few well-behaved mutators.
 */

import { clamp, clamp01, TAU } from "../core/utils.js";
import { CAR, stepVehicle, updateGearbox } from "./physics.js";
import { makeTyre, tyreGrip, fuelBurnRate, COMPOUNDS, LAP_TIME_REF } from "./tires.js";

let nextVehicleId = 1;

export class Vehicle {
  constructor({ driver, team, spec, isPlayer = false, assists = {}, compound = "soft", fuel = 0, track, rng }) {
    this.id = nextVehicleId++;
    this.driver = driver;
    this.team = team;
    this.spec = spec;
    this.isPlayer = isPlayer;
    this.rng = rng;
    this.assists = assists;

    // --- physical state
    this.x = 0; this.y = 0;
    this.heading = 0;
    this.vx = 0; this.vy = 0;
    this.speed = 0; this.vLong = 0; this.vLat = 0;
    this.yawRate = 0; this.slipAngle = 0; this.slipMagnitude = 0;
    this.gear = 1; this.rpm = CAR.idleRpm; this.shiftTimer = 0; this.justShifted = false;
    this.wheelSpin = 0;
    this.towFactor = 1; this.slipstream = 0;

    // --- world state
    this.odo = 0;             // unwrapped distance from the start line
    this.s = 0;               // wrapped distance along the lap
    this.lateral = 0;
    this.trackIndex = 0;
    this.surface = "asphalt";
    this.latGrip = 1;
    this.damage = 0;
    this.impactFlash = 0;
    this.lastImpact = 0;

    // --- controls
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.desiredControls = { throttle: 0, brake: 0, steer: 0, handbrake: false };

    // --- race state
    this.startOdo = 0;
    this.lap = 0;             // laps completed
    this.position = 1;
    this.gridSlot = 0;
    this.finished = false;
    this.finishTime = null;
    this.retired = false;
    this.retireReason = "";
    this.classified = false;

    // --- timing
    this.lapStartTime = 0;
    this.lastLapTime = null;
    this.bestLapTime = null;
    this.lapTimes = [];
    this.sectorTimes = [null, null, null];
    this.bestSectors = [null, null, null];
    this.lastSectorDelta = [null, null, null];
    this.sectorIndex = 0;
    this.positionTime = 0;     // time in the session at the last sector line
    this.interval = 0;         // gap to the car ahead (seconds)
    this.gain = 0;             // places gained/lost on the previous lap

    // --- strategy
    this.tire = makeTyre(compound, track || { abrasiveness: 1 });
    this.startCompound = compound;
    this.fuel = fuel;
    this.fuelCapacity = 110;
    this.stints = [];
    this.pitStops = 0;
    this.pit = {
      requested: false, inLane: false, stopped: false, timer: 0,
      duration: 0, targetCompound: null, refuelling: 0, ready: false,
      entryS: 0, boxS: 0, exitS: 0, minLap: 1,
    };
    this.inPitLane = false;
    this.pitStopped = false;
    this.mandatoryPit = true;
    this.pitDone = false;

    // --- presentation
    this.color = team?.color || "#e10600";
    this.accent = team?.accent || "#ffffff";
    this.skid = 0;
    this.wheelAngle = 0;
    this.lastGearChange = 0;
  }

  /* ------------------------------ placement ------------------------------ */

  placeAt(track, odo, lateral = 0) {
    this.odo = odo;
    this.s = track.wrapS(odo);
    const i = track.indexAt(this.s);
    this.trackIndex = i;
    this.lateral = lateral;
    const p = track.pointAt(this.s, lateral);
    this.x = p.x; this.y = p.y;
    this.heading = track.heading[i];
    this.vx = 0; this.vy = 0; this.speed = 0; this.gear = 1; this.rpm = CAR.idleRpm;
    this.startOdo = odo;
    this.lap = 0;
  }

  placeOnGrid(track, slot) {
    // Two-by-two staggered grid, nine metres apart, behind the line.
    const row = Math.floor(slot / 2);
    const side = slot % 2 === 0 ? -1 : 1;
    this.placeAt(track, -(12 + row * 9), side * 3.6);
    this.gridSlot = slot;
    return this;
  }

  placeOnTrack(track, s, lateral = 0, speed = 0) {
    this.placeAt(track, s, lateral);
    this.vx = Math.cos(this.heading) * speed;
    this.vy = Math.sin(this.heading) * speed;
    this.speed = speed;
    return this;
  }

  /* ------------------------------ updates ------------------------------ */

  /** Re-project onto the track and keep the odometer continuous. */
  syncTrack(track) {
    const p = track.project(this.x, this.y, this.trackIndex);
    const L = track.length;
    if (p.dist2 > 260 * 260) {
      // Far from the racing surface: fall back to a global search and
      // re-anchor the odometer to the closest point.
      const g = track.project(this.x, this.y, -1);
      this.odo = Math.floor(this.odo / L) * L + g.s;
      this.s = g.s;
      this.trackIndex = g.index;
      this.lateral = g.lateral;
      return;
    }
    const d = p.s - this.s;
    if (d < -L / 2) this.odo += L;
    else if (d > L / 2) this.odo -= L;
    this.odo += d;                 // continuous odometer, not just per-lap jumps
    this.s = p.s;
    this.trackIndex = p.index;
    this.lateral = p.lateral;
  }

  /** Physics + gearbox sub-step. */
  stepPhysics(dt, track, surfaceName) {
    if (this.retired) {
      this.speed = 0; this.vx = 0; this.vy = 0;
      return;
    }
    this.surface = surfaceName;
    this.controls.throttle = clamp01(this.desiredControls.throttle);
    this.controls.brake = clamp01(this.desiredControls.brake);
    this.controls.steer = clamp(this.desiredControls.steer, -1, 1);
    this.controls.handbrake = !!this.desiredControls.handbrake;

    this.latGrip = tyreGrip(this.tire) * (1 - this.damage * 0.1);
    this.inPitLane = isInPitLane(track, this.s, this.lateral);

    stepVehicle(this, dt, { track });
    updateGearbox(this, dt);

    // Fuel burn.
    if (this.fuel > 0 && !this.retired) {
      this.fuel = Math.max(0, this.fuel - fuelBurnRate(this.controls.throttle, this.speed) * dt);
    }

    // Tyre wear integrates continuously so the HUD, the grip model and the
    // strategy logic always agree on the same number.
    const c = COMPOUNDS[this.tire.compound] || COMPOUNDS.soft;
    const load = clamp(0.35 + Math.abs(this.lateralG) / 18 + this.slipMagnitude * 0.35, 0.3, 1.8);
    const perSecond = (0.2 * c.degFactor * (track?.abrasiveness ?? 1) * load) / LAP_TIME_REF;
    this.tire.wear = clamp01(this.tire.wear + perSecond * dt);
    this.tire.temp = clamp(this.tire.temp + (this.speed > 12 ? 0.006 : -0.0035) * dt * (1 - this.damage * 0.5), 0.2, 1);

    this.wheelAngle = (this.wheelAngle + this.yawRate * dt * 2.4) % TAU;
    this.impactFlash = Math.max(0, this.impactFlash - dt * 3);
    this.lastImpact = Math.max(0, (this.lastImpact || 0) - dt * 6);
    this.skid = Math.max(this.skid * 0.94, this.slipMagnitude);
  }

  /* ------------------------------ strategy ------------------------------ */

  requestPit(compound, refuelTo = null) {
    if (this.pitStops >= 4) return false;
    this.pit.requested = true;
    this.pit.targetCompound = compound;
    this.pit.refuelling = refuelTo;
    return true;
  }

  cancelPit() {
    this.pit.requested = false;
    this.pit.targetCompound = null;
    this.pit.refuelling = null;
  }

  startPitStop(duration, compound, fuel) {
    this.pit.stopped = true;
    this.pit.timer = duration;
    this.pit.duration = duration;
    this.pit.requested = false;
    this.pit.targetCompound = null;
    this.pitStopped = true;
    this.pitStops++;
    this.pitDone = true;
    this.stints.push({ compound: this.tire.compound, laps: this.tire.laps, endLap: this.lap });
    if (compound && compound !== this.tire.compound) {
      this.tire = makeTyre(compound, this._track);
      this.tire.stintStartLap = this.lap + 1;
    } else {
      this.tire.wear = 0;
      this.tire.laps = 0;
      this.tire.grained = 0;
      this.tire.stintStartLap = this.lap + 1;
    }
    if (fuel != null) this.fuel = Math.min(this.fuelCapacity, fuel);
  }

  endPitStop() {
    this.pit.stopped = false;
    this.pitStopped = false;
    this.pit.timer = 0;
    this.pit.ready = false;
    this.pit.inLane = false;
  }

  setTrack(track) {
    this._track = track;
  }

  /* ------------------------------ readouts ------------------------------ */

  /** Laps completed since the session started. */
  get lapsDone() {
    const L = this._length;
    if (!L) return 0;
    return Math.floor(this.odo / L) - Math.floor(this.startOdo / L);
  }

  /** Monotonic distance used for classification. */
  get progressValue() {
    return this.odo;
  }

  get kmh() {
    return this.speed * 3.6;
  }

  snapshot() {
    return {
      id: this.id, position: this.position, x: this.x, y: this.y,
      heading: this.heading, speed: this.speed, gear: this.gear,
      color: this.color, accent: this.accent,
      driver: this.driver.short, team: this.team.short, isPlayer: this.isPlayer,
    };
  }
}

/** Set `_length` for every vehicle once the track is known. */
export function bindTrack(vehicles, track) {
  for (const v of vehicles) {
    v._length = track.length;
    v.setTrack(track);
  }
}

function isInPitLane(track, s, lateral) {
  // Only inside the pit window: running wide anywhere else is just a big.
  if (!track.inPitWindow(s)) return false;
  const i = track.indexAt(s);
  return lateral > track.halfWidth[i] + 1.6;
}
