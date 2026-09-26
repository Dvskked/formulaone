/**
 * ai.js â€” AI driver controller.
 *
 * Pure-pursuit steering towards a look-ahead point on the racing line,
 * braking-distance-aware corner speed planning, simple traffic management,
 * defensive line selection and a sprinkling of human error.
 */

import { clamp, clamp01, lerp, wrapPi, angleDelta, sign } from "../core/utils.js";
import { tyreGrip } from "./tires.js";
import { driverRating } from "../data/teams-data.js";

const CORNER_MARGIN = 0.88;      // fraction of the grip ceiling an AI aims for
const BRAKE_ACCEL = 21;          // m/s^2 assumed for planning
const CAR_WIDTH = 2.2;

export class AIController {
  /**
   * @param {import('./vehicle.js').Vehicle} vehicle
   * @param {import('./track.js').Track} track
   * @param {object} profile { pace, consistency, aggression, racecraft, defence, tyres }
   */
  constructor(vehicle, track, profile = {}) {
    this.v = vehicle;
    this.track = track;
    const d = vehicle.driver;
    const s = d?.stats || {};
    this.profile = {
      pace: profile.pace ?? clamp(0.9 + (s.pace ?? 88) / 500, 0.9, 1.02),
      consistency: profile.consistency ?? (s.consistency ?? 88) / 100,
      aggression: profile.aggression ?? (s.aggression ?? 85) / 100,
      racecraft: profile.racecraft ?? (s.racecraft ?? 88) / 100,
      defence: profile.defence ?? (s.defence ?? 86) / 100,
      tyres: profile.tyres ?? (s.tyres ?? 88) / 100,
    };
    this.rng = typeof profile.rng === "function"
      ? profile.rng
      : (profile.rng && typeof profile.rng.next === "function" ? profile.rng.next.bind(profile.rng) : Math.random);
    this.time = 0;
    // How close to the theoretical ceiling this driver runs (0..1).
    this.quality = clamp01((this.profile.pace - 0.9) / 0.14);
    this.laneBias = (this.rng() - 0.5) * 3.2;      // preferred line offset
    this.noisePhase = this.rng() * 100;
    this.mistakeTimer = 3 + this.rng() * 12;
    this.mistake = 0;
    this.laneShift = 0;
    this.targetLateral = 0;
    this.reaction = lerp(0.34, 0.09, this.profile.racecraft);
    this.stuck = 0;
    this.blocked = false;
  }

  /** @param {object} world { cars, time, raceState } */
  update(dt, world) {
    this.time += dt;
    const v = this.v, track = this.track;
    if (v.retired || v.finished) {
      // Out of the race: ease off to a stop. Do not brake to a standstill and
      // then let the reverse gear drag the car back down the track.
      v.desiredControls = { throttle: 0, brake: v.retired ? 1 : 0.22, steer: 0, handbrake: false };
      return;
    }

    const speed = v.speed;
    const tyreFactor = tyreGrip(v.tire);
    const carLat = v.spec.latAccel * tyreFactor * (1 - v.damage * 0.1);
    const margin = CORNER_MARGIN * lerp(0.9, 1.0, this.quality) * lerp(0.94, 1.0, this.profile.consistency);

    // ---- wrong-way recovery ----------------------------------------------
    // A car that has spun is pointing back down the circuit. Left to the normal
    // pure-pursuit controller it will drive the whole race the wrong way round.
    // Drive *forward* along the nose (throttle, not the brake pedal) while
    // steering the nose back down the track: the brake pedal engages reverse,
    // which from a backwards-facing car just speeds it further up the circuit.
    const off = angleDelta(track.heading[v.trackIndex], v.heading);
    if (Math.abs(off) > Math.PI * 0.55 && !v.inPitLane && !v.ended) {
      this.stuck = 0;
      v.desiredControls = {
        throttle: 0.5,
        brake: 0,
        steer: clamp(-off * 1.6, -1, 1),
        handbrake: false,
      };
      return;
    }

    // ---- occasional human error -----------------------------------------
    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0) {
      this.mistakeTimer = lerp(22, 5, 1 - this.profile.consistency) + this.rng() * 14;
      this.mistake = (this.rng() - 0.45) * lerp(2.4, 0.4, this.profile.consistency);
    }
    this.mistake *= Math.exp(-dt * 1.1);

    // ---- traffic ---------------------------------------------------------
    const traffic = this._scanTraffic(world, dt);
    // Patience: the longer we have been stuck behind someone, the less we
    // care about matching their speed and the harder we commit to a side.
    this.blocked = traffic.limit != null ? this.blocked + dt : 0;
    this.laneShift = lerp(this.laneShift, traffic.laneShift, 1 - Math.exp(-dt * (2.6 + this.blocked * 0.4)));

    // ---- pit lane target --------------------------------------------------
    const pit = track.pit;
    const pitting = v.pit.requested;
    // Each car gets its own slot across the lane so the field does not pile
    // up on one line when everyone comes in together.
    const laneSlot = (((v.gridSlot ?? 0) % 4) - 1.5) * 1.5;
    const laneLat = track.pitLaneLateral(v.s, v.gridSlot ?? 0);
    // Once clear of the lane the "give up and merge out" instruction is spent.
    if (!v.inPitLane) v.pit.rejoin = false;
    if (v.inPitLane) {
      // Already in the lane: stay until past the exit transition, then merge.
      // `pit.rejoin` means the car gave up on this stop and must get out.
      const hold = pitting || (track.signedDelta(v.s, pit.wallS1) > -25 && !v.pit.rejoin);
      if (hold) this.targetLateral = laneLat;
      else this.targetLateral = laneLat - (laneLat - track.rlLateral[track.indexAt(v.s + 20)]) * 0.75;
    } else if (pitting) {
      const toEntry = track.delta(v.s, pit.entryS);
      if (track.inPitWindow(v.s)) {
        this.targetLateral = laneLat;
      } else if (toEntry < 330) {
        // Line up on the right-hand edge so the entry crossing is clean. Start
        // early: the car has to shed speed *and* move ~8m sideways before it
        // reaches the lane, and doing both at the end does not work.
        const i = track.indexAt(v.s + 20);
        this.targetLateral = track.halfWidth[i] - 2.4;
      } else {
        this.targetLateral = 0;
      }
    } else {
      const lookIdx = track.indexAt(v.s + Math.max(14, speed * 0.5));
      let lat = track.rlLateral[lookIdx] + this.laneBias;
      lat += this.laneShift;
      if (traffic.defend) lat += traffic.defendOffset;
      const limit = track.halfWidth[lookIdx] - 1.2;
      this.targetLateral = clamp(lat, -limit, limit);
    }

    // ---- off-track recovery ----------------------------------------------
    // A car that has genuinely run wide must forget about racing and simply
    // get back on the circuit. Left on the normal target it keeps steering
    // into the barrier and picks up terminal damage. The pit lane and a
    // committed pit entry are excluded: there the car is meant to be off the
    // racing surface, and the barrier is a wall it must not be pulled into.
    const edge = track.halfWidth[v.trackIndex];
    const offBy = Math.abs(v.lateral) - edge;
    const offTrack = !v.inPitLane && !(pitting && track.inPitWindow(v.s)) && offBy > 1.4;
    if (offTrack) {
      const inLimit = Math.max(0.6, edge - 1.4);
      this.targetLateral = clamp(this.targetLateral * 0.25, -inLimit, inLimit);
      this.laneShift *= 0.2;
    }

    // ---- steering (pure pursuit) ------------------------------------------
    // The look-ahead point is the racing line shifted by an ABSOLUTE lateral
    // offset from the centreline (rlLateral is already baked into rlX/rlY).
    const look = clamp(11 + speed * 0.62, 12, 78);
    const targetIdx = track.indexAt(v.s + look);
    const base = { x: track.rlX[targetIdx], y: track.rlY[targetIdx] };
    const normal = { x: track.nx[targetIdx], y: track.ny[targetIdx] };
    const tx = base.x + normal.x * (this.targetLateral - track.rlLateral[targetIdx]);
    const ty = base.y + normal.y * (this.targetLateral - track.rlLateral[targetIdx]);

    const toTarget = Math.atan2(ty - v.y, tx - v.x);
    const err = angleDelta(v.heading, toTarget);
    let steer = clamp(err * 2.1 - v.slipAngle * 0.85, -1, 1);
    // Smooth so the car does not saw at the steering limit.
    const noise = Math.sin(this.time * 1.1 + this.noisePhase) * 0.03 * (1 - this.profile.consistency);
    steer = clamp(steer + noise + this.mistake * 0.35, -1, 1);

    // ---- speed planning ---------------------------------------------------
    let vTarget = v.spec.topSpeed * 1.02;
    const horizon = clamp(28 + speed * 2.4, 40, 320);
    const decel = BRAKE_ACCEL * lerp(0.82, 1.02, this.quality);
    for (let d = 2; d < horizon; d += 7) {
      const i = track.indexAt(v.s + d);
      const k = Math.abs(track.rlKappa[i]);
      const vc = k < 1e-5 ? 999 : Math.sqrt(carLat / k) * margin;
      const allowed = Math.sqrt(vc * vc + 2 * decel * d);
      if (allowed < vTarget) vTarget = allowed;
    }
    // Damage and rough surfaces slow the whole car down.
    vTarget *= 1 - v.damage * 0.16;
    if (v.surface === "grass") vTarget = Math.min(vTarget, 34);
    if (v.surface === "kerb") vTarget *= 0.96;
    if (v.inPitLane) vTarget = Math.min(vTarget, track.pit.speedLimit * 0.92);
    if (pitting) {
      // Pit entry has to be taken at pit-lane speed. Arriving at racing speed
      // makes the lateral move into the lane impossible.
      const toEntry = track.delta(v.s, track.pit.entryS);
      const ahead = toEntry < 400 ? 1 : 0;
      if (ahead || track.inPitWindow(v.s)) vTarget = Math.min(vTarget, track.pit.speedLimit * 0.95);
    }
    const toBoxNow = track.signedDelta(v.s, track.pit.boxS);
    if (pitting && v.inPitLane && Math.abs(toBoxNow) < 14) vTarget = 1.2;
    else if (pitting && v.inPitLane) {
      // Queuing for the box. Keep rolling at pit-lane speed instead of
      // crawling, otherwise a queue of cars behind one being serviced never
      // moves and the whole lane gridlocks.
      vTarget = Math.min(vTarget, 9);
    }
    if (this.mistake < -0.4) vTarget *= 0.94;
    vTarget *= lerp(0.995, 1.005, this.profile.consistency);

    if (traffic.limit != null) vTarget = Math.min(vTarget, traffic.limit);

    // ---- pedals -----------------------------------------------------------
    const dv = vTarget - speed;
    let throttle = 0, brake = 0;
    if (dv > 0.4) throttle = clamp01(dv / 6);
    else if (dv < -0.6) brake = clamp01(-dv / 9);
    else throttle = 0.45;

    // Do not add power while the car is still rotating.
    const cornering = Math.abs(steer) > 0.35 && speed > 18;
    if (cornering) throttle *= lerp(1, 0.42, clamp01((Math.abs(steer) - 0.35) / 0.5));
    if (Math.abs(v.slipAngle) > 0.16) throttle *= 0.35;
    if (v.fuel <= 0.2) throttle *= 0.35;

    // ---- recovery ---------------------------------------------------------
    if (offTrack) {
      // Off the racing surface: aim back to the centre and be gentle. Throttle
      // is limited so the car does not simply understeer into the wall.
      throttle = Math.min(throttle, 0.55);
      if (offBy > 6) throttle = Math.min(throttle, 0.3);
    }
    if (speed < 1.2 && !v.pitStopped) {
      this.stuck += dt;
      if (this.stuck > 1.4) { throttle = 1; brake = 0; }
      if (this.stuck > 6) {
        // Reverse out.
        throttle = 0; brake = 1; steer = -sign(v.lateral || 1) * 0.7;
        if (this.stuck > 8) this.stuck = 0;
      }
    } else this.stuck = 0;

    v.desiredControls = {
      throttle: clamp01(throttle),
      brake: clamp01(brake),
      steer,
      handbrake: false,
    };
  }

  /** Look for cars ahead and decide whether to lift, pass or defend. */
  _scanTraffic(world, dt) {
    const v = this.v, track = this.track;
    const patience = clamp01(this.blocked / 5);
    let limit = null;
    let laneShift = 0;
    let defend = false;
    let defendOffset = 0;
    let closestAhead = Infinity;

    for (const other of world.cars) {
      if (other === v || other.parked) continue;
      const gap = track.signedDelta(v.s, other.s);
      if (gap <= 0 || gap > 45) continue;
      const dLat = other.lateral - v.lateral;
      const lateralGap = Math.abs(dLat) - CAR_WIDTH;
      if (gap < closestAhead) closestAhead = gap;

      if (lateralGap < CAR_WIDTH) {
        // Directly in front. Match its speed with a small time gap, then move
        // across early enough to actually get past.
        const safe = Math.max(12, other.speed - Math.max(0, 26 - gap) * 0.22);
        limit = Math.min(limit ?? Infinity, safe);
        if (gap < 30) {
          const side = dLat > 0 ? -1 : 1;   // pick the side with more room
          const room = this._roomFor(v, side);
          const commit = 1 + patience * 0.8;
          laneShift += side * lerp(1.6, 4.6, this.profile.aggression) * room * commit;
        }
      } else if (gap < 30) {
        // Alongside: hold your line, and give a little room if they are quicker.
        const behindGap = track.signedDelta(other.s, v.s);
        if (behindGap < 15 && other.speed > v.speed + 0.4) {
          laneShift -= sign(dLat || 1) * 1.4 * this.profile.aggression;
        }
        if (behindGap < 12 && other.speed > v.speed + 0.2) {
          const inside = -sign(track.rlKappa[v.trackIndex] || 1);
          laneShift += inside * 1.8 * this.profile.defence;
        }
      }
    }

    // Blown hairpin: back out rather than drive into the back of them.
    if (closestAhead < 8 && limit == null) limit = 12;

    return {
      limit,
      laneShift: clamp(laneShift, -6, 6),
      defend,
      defendOffset: clamp(defendOffset, -4, 4),
    };
  }

  _roomFor(v, side) {
    const track = this.track;
    const i = track.indexAt(v.s + 22);
    const limit = track.halfWidth[i] - 1.4;
    const target = clamp(v.lateral + side * 4.5, -limit, limit);
    return clamp01((target - v.lateral) / (side * 4.5 || 1));
  }
}

/** Build a controller profile for a driver/team pairing. */
export function makeAIProfile(driver, car, rng, opts = {}) {
  const rating = driverRating(driver);
  return {
    pace: clamp(0.9 + (rating - 84) / 260 + (car.topSpeed - 90) * 0.0016, 0.9, 1.03),
    consistency: driver.stats.consistency / 100,
    aggression: driver.stats.aggression / 100,
    racecraft: driver.stats.racecraft / 100,
    defence: driver.stats.defence / 100,
    tyres: driver.stats.tyres / 100,
    rng,
    ...opts,
  };
}
