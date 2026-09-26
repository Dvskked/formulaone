/**
 * race-engine.js — the Grand Prix.
 *
 * Adds grid order, the standing start, mandatory pit stops, strategy for AI,
 * mechanical retirements, flags, the fastest lap, points and classification
 * on top of the shared session core.
 */

import { Session, SESSION_STATE } from "./session.js";
import { RACE_POINTS, FASTEST_LAP_POINT } from "../data/circuits-data.js";
import { COMPOUNDS, pitStopTime, raceFuelLoad, planStrategy, tyreLifeEstimate, makeTyre } from "./tires.js";

export const FLAG = { GREEN: "green", YELLOW: "yellow", CHEQUERED: "chequered" };

const PIT_BOX_RADIUS = 10;      // metres either side of the box
const PIT_LANE_TIMEOUT = 16;   // seconds of crawling before a car rejoins
const CHEQUERED_GRACE = 25;     // seconds given to cars about to take the flag

export class RaceEngine extends Session {
  constructor(opts) {
    super({ ...opts, type: "race" });
    this.totalLaps = opts.laps ?? 6;
    this.raceTime = 0;
    this.flag = FLAG.GREEN;
    this.fastestLap = null;
    this.chequered = false;
    this.chequeredAt = null;
    this.results = null;
    this._yellowCars = new Map();
    this._failRoll = new Map();
  }

  /* ------------------------------------------------------------------ */
  /* Construction                                                        */
  /* ------------------------------------------------------------------ */

  /** Build the race from a qualifying classification. */
  static fromGrid({ track, entries, playerId, laps, seed, assists, autopilot = false }) {
    const engine = new RaceEngine({ track, entries, laps, seed, assists });
    const order = entries.slice().sort((a, b) => (a.gridPos ?? 99) - (b.gridPos ?? 99));
    order.forEach((e, i) => {
      engine.addEntry({
        team: e.team, driver: e.driver, spec: e.spec,
        isPlayer: e.driver.id === playerId,
        gridSlot: i,
        autopilot,
        compound: i < 8 ? "soft" : i < 14 ? "medium" : "hard",
      });
    });
    engine.finalise();
    engine.applyGrid();
    engine.assignStartFuel();
    engine.assignAIStrategy();
    engine.gridOrderSnapshot = order.map((e, i) => ({ driverId: e.driver.id, pos: i + 1 }));
    return engine;
  }

  applyGrid() {
    for (const v of this.cars) v.placeOnGrid(this.track, v.gridSlot);
  }

  assignStartFuel() {
    const load = raceFuelLoad(this.totalLaps) + 1.4;
    for (const v of this.cars) {
      v.fuelCapacity = load + 8;
      v.fuel = v.isPlayer ? load : load * (0.95 + this.rng.next() * 0.1);
      v.startFuel = v.fuel;
    }
  }

  assignAIStrategy() {
    for (const v of this.cars) {
      if (v.isPlayer && !this.controllers.has(v.id)) continue;
      const tm = v.driver.stats.tyres / 100;
      const aggr = v.driver.stats.aggression / 100;
      const pref = tm > 0.92 ? "oneStop" : aggr > 0.9 ? "aggressive" : "balanced";
      v.stintPlan = planStrategy(this.track, this.totalLaps, pref);
      v.stintCursor = 0;
      // The car must start on the compound its own plan opens with, otherwise
      // it burns the softs off the grid and then pits back onto the same
      // rubber — which costs a stop and wrecks the whole field's spread.
      const opener = v.stintPlan[0].compound;
      if (v.tire.compound !== opener) {
        v.tire = makeTyre(opener, this.track, 0);
        v.startCompound = opener;
      }
      // Stagger the stops across the field so the whole grid does not arrive
      // in the pit lane on the same lap. Cars sharing a plan otherwise all
      // come in together, and a lane that can only service one car at a time
      // deadlocks with a queue that never clears.
      const stagger = this.rng.next() * 1.7 - 0.35;
      v.pitLapTarget = Math.max(1, v.stintPlan[0].laps + stagger);
    }
  }
  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  begin() {
    this.state = SESSION_STATE.COUNTDOWN;
    this.countdown = 5.4;
    this.countdownStep = 0;
    this.raceTime = 0;
    return this;
  }

  update(dt, playerInput) {
    if (this.paused || this.state === SESSION_STATE.FINISHED) return;
    super.update(dt, playerInput);
  }

  /** Fixed step: the race clock lives here so headless stepping works too. */
  step(dt, playerInput) {
    if (this.paused || this.state === SESSION_STATE.FINISHED) return;
    if (this.state === SESSION_STATE.GREEN) this.raceTime += dt;
    super.step(dt, playerInput);
  }

  /* ------------------------------------------------------------------ */
  /* Per-step race logic                                                 */
  /* ------------------------------------------------------------------ */

  _stepCars(dt, playerInput, frozen) {
    super._stepCars(dt, playerInput, frozen);
    if (this.state !== SESSION_STATE.GREEN) return;
    for (const v of this.cars) {
      if (v.parked) continue;
      this._pitLogic(v, dt);
      this._mechanical(v, dt);
      this._flagLogic(v, dt);
    }
    // Strategy only needs a few decisions a second, not 120.
    this._strategyClock = (this._strategyClock ?? 0) + dt;
    if (this._strategyClock >= 0.25) {
      this._strategyClock = 0;
      for (const v of this.cars) if (!v.isPlayer || this.controllers.has(v.id)) this._aiStrategy(v);
    }
  }

  /* ---------------------------- pit stops ---------------------------- */

  _pitLogic(v, dt) {
    const track = this.track;
    // Positive = the box is still ahead of the car.
    const toBox = track.signedDelta(v.s, track.pit.boxS);

    if (v.pit.stopped) {
      v.pit.timer -= dt;
      v.controls.brake = 1;
      v.controls.throttle = 0;
      if (v.pit.timer <= 0) {
        v.endPitStop();
        // Advance the plan only once the stop is actually done. Doing it when
        // the stop was *requested* meant a missed box left the car one stint
        // short of its mandatory stop with no way to ask again.
        this._advanceStintPlan(v);
        this.pushMessage(`${v.driver.short} rejoins on ${COMPOUNDS[v.tire.compound].short}`, "info", v);
      }
      return;
    }

    if (!v.pit.requested || v.retired || v.finished) return;

    // A wide capture window lets three or four cars satisfy "I am at the box"
    // at once and stop on top of each other, which deadlocks the lane. Keep it
    // tight so one car is serviced at a time, and let the rest queue.
    if (Math.abs(toBox) < PIT_BOX_RADIUS && v.inPitLane && v.speed < 5) {
      const compound = v.pit.targetCompound || v.tire.compound;
      const t = pitStopTime(v.spec, v.team.stats, compound);
      const remaining = Math.max(2, this.totalLaps - v.raceLaps);
      const fuel = v.pit.refuelling != null ? v.pit.refuelling : raceFuelLoad(remaining) + 1.2;
      v.startPitStop(t.stationary, compound, Math.min(v.fuelCapacity, fuel));
      this.pushMessage(`${v.driver.short} pits — ${t.stationary.toFixed(1)}s stop`, "info", v);
      if (v.isPlayer) this.onPlayerPit?.(v, t);
      return;
    }
    // Overshot the box by a car length or more. The request is dropped so the
    // car can rejoin, but `pitRetryAt` lets the AI ask again on the next lap -
    // the mandatory-stop rule cannot be satisfied by a missed entry.
    if (toBox < -14 && toBox > -110) {
      v.cancelPit();
      v.pitRetryAt = this.raceTime + 6;
      if (v.isPlayer) this.pushMessage("Pit entry missed - request cancelled", "bad", v);
    }

    // Crawling down a congested lane. Rather than sit there for the rest of
    // the race, abandon the stop and rejoin, then try again next lap. The
    // mandatory-stop rule is still satisfied because _aiStrategy will re-request.
    if (v.speed < 2) v.pitLaneStuck = (v.pitLaneStuck ?? 0) + dt;
    else v.pitLaneStuck = 0;
    if (v.pitLaneStuck > PIT_LANE_TIMEOUT) {
      v.pitLaneStuck = 0;
      v.cancelPit();
      v.pitRetryAt = this.raceTime + 8;
      // Tell the driver to merge out rather than crawl on to an empty box.
      v.pit.rejoin = true;
    }
  }

  /** AI decide when to come in. Evaluated a few times a second. */
  _aiStrategy(v) {
    if (v.retired || v.finished || v.pit.requested || v.pit.stopped) return;
    if (v.pitRetryAt != null && this.raceTime < v.pitRetryAt) return;
    const lapsDone = v.raceLaps;
    const life = tyreLifeEstimate(v.tire.compound, this.track);
    const urgent = v.tire.wear > 0.86 || v.tire.laps >= life - 0.5;
    const maxStops = v.stintPlan.length;
    if (v.pitStops >= maxStops && !urgent) return;
    const target = v.pitLapTarget ?? 99;
    const scheduled = lapsDone >= target;
    if (!urgent && !scheduled) return;
    // A stop is mandatory. Only refuse once there is literally nothing left to
    // race — otherwise a long opening stint would let a car skip the pits
    // altogether and the mandatory-stop rule stops meaning anything.
    if (this.totalLaps - lapsDone <= 0 && !urgent) return;

    const remaining = this.totalLaps - lapsDone;
    const next = v.stintPlan[Math.min((v.stintCursor ?? 0) + 1, v.stintPlan.length - 1)];
    const compound = urgent && !next ? v.tire.compound : (next?.compound ?? v.tire.compound);
    v.requestPit(compound, Math.min(v.fuelCapacity, raceFuelLoad(remaining) + 1.2));
  }

  /** Move a car onto the next stint of its plan after a completed stop. */
  _advanceStintPlan(v) {
    v.stintCursor = Math.min((v.stintCursor ?? 0) + 1, Math.max(0, v.stintPlan.length - 1));
    const next = v.stintPlan[v.stintCursor];
    v.pitLapTarget = v.raceLaps + (next?.laps ?? 3);
  }

  /* --------------------------- retirements ---------------------------- */

  _mechanical(v, dt) {
    if (v.retired || v.finished) return;
    // Base failure rate from the car's reliability, plus a strongly
    // super-linear penalty for accumulated damage. Quadratic (not linear)
    // because light contact is survivable and terminal damage is not.
    const wear = v.damage * v.damage * v.damage;
    const perSecond = (1 - v.spec.reliability) * 0.0007 + wear * 0.05
      + (v.damage > 0.88 ? 0.02 : 0);
    if (this.rng.next() < perSecond * dt) {
      this.retire(v, v.damage > 0.55 ? "Terminal damage" : "Mechanical failure");
    }
  }

  retire(v, reason) {
    if (v.retired) return;
    v.retired = true;
    v.ended = true;
    v.retireReason = reason;
    v.vx = 0; v.vy = 0; v.speed = 0; v.gear = 1;
    // Park the wreck in the gravel beyond the barrier. It keeps its odometer
    // (so it stays classified where it stopped) but is out of everyone's way.
    const i = v.trackIndex;
    v.lateral = (v.lateral < 0 ? -1 : 1) * (this.track.halfWidth[i] + 16);
    const pt = this.track.pointAt(v.s, v.lateral);
    v.x = pt.x; v.y = pt.y;
    v.heading = this.track.heading[i];
    v.parked = true;
    v.parkedAt = this.raceTime;
    this.pushMessage(`${v.driver.short} retires — ${reason}`, "bad", v);
    this.onRetire?.(v, reason);
  }

  /* ------------------------------ flags ------------------------------- */

  _flagLogic(v, dt) {
    if (v.retired || v.finished || v.pit.stopped) return;
    this._flagHold = Math.max(0, (this._flagHold || 0) - dt);
    if (v.speed < 1.6) {
      const t = (this._yellowCars.get(v.id) || 0) + dt;
      this._yellowCars.set(v.id, t);
      if (t > 1.6 && this.flag === FLAG.GREEN && this._flagHold <= 0) {
        this.flag = FLAG.YELLOW;
        this.pushMessage("YELLOW FLAG — incident on track", "warn");
      }
    } else {
      this._yellowCars.delete(v.id);
    }
    if (this.flag === FLAG.YELLOW && this._yellowCars.size === 0) {
      this.flag = FLAG.GREEN;
      this._flagHold = 8;
      this.pushMessage("Track clear — green flag", "good");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Session hooks                                                       */
  /* ------------------------------------------------------------------ */

  onLapComplete(v, lap, lapTime) {
    if (v.retired) return;
    if (!this.fastestLap || lapTime < this.fastestLap.time) {
      this.fastestLap = { time: lapTime, vehicle: v, driverId: v.driver.id, lap };
      this.pushMessage(
        v.isPlayer ? "Personal fastest lap" : `Fastest lap: ${v.driver.short}`,
        v.isPlayer ? "good" : "info", v
      );
    }
    if (v.isPlayer) {
      const c = COMPOUNDS[v.tire.compound];
      this.pushMessage(
        `Lap ${lap} — ${fmtTime(lapTime)} · ${c.short} at ${Math.round(v.tire.wear * 100)}% wear`,
        lapTime <= (v.bestLapTime ?? Infinity) ? "good" : "info", v
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /* End conditions                                                      */
  /* ------------------------------------------------------------------ */

  _checkEndConditions() {
    if (this.state !== SESSION_STATE.GREEN) return;
    // Safety net: if the leader retires, promote the next highest lap counter.
    const leader = this.cars.reduce((a, b) => (b.raceLaps > a.raceLaps ? b : a), this.cars[0]);
    if (!this.chequered && leader.raceLaps >= this.totalLaps) {
      this.chequered = true;
      this.chequeredAt = this.raceTime;
      this.leaderFinish = leader.finishTime = this.raceTime;
      leader.finished = true;
      leader.ended = true;
      leader.classified = true;
      this.flag = FLAG.CHEQUERED;
      this.pushMessage("Chequered flag!", "good");
    }
    if (!this.chequered) {
      // Nothing left running: the race is over even without a flag.
      if (this.cars.every((v) => v.finished || v.retired)) this.buildResults();
      return;
    }

    for (const v of this.cars) {
      if (v.finished || v.retired) continue;
      if (v.raceLaps >= this.totalLaps) {
        v.finishTime = this.raceTime;
        v.finished = true;
        v.ended = true;
        v.classified = true;
        this.onFinish?.(v, v.finishTime);
      } else if (this.raceTime - this.chequeredAt > CHEQUERED_GRACE) {
        // The flag is out and the grace window has closed. In real life these
        // cars are classified, not retired: they take the flag where they
        // stand. Extrapolate a finishing time from their remaining distance
        // so the classification still orders correctly.
        this.classifyStraggler(v);
      }
    }
    if (this.cars.every((v) => v.finished || v.retired)) this.buildResults();
  }

  /** Take the flag where the car stands. Never a DNF, always classified. */
  classifyStraggler(v) {
    const speed = Math.max(12, v.speed);
    const lapsDown = this.totalLaps - v.raceLaps;
    v.finishTime = this.chequeredAt + v.distanceToLine / speed + lapsDown * 45;
    v.finished = true;
    v.ended = true;
    v.classified = true;
    v.lapped = lapsDown;
    this.onFinish?.(v, v.finishTime);
  }

  buildResults() {
    if (this.results) return this.results;
    const order = this.cars.slice().sort((a, b) => {
      if (a.classified !== b.classified) return a.classified ? -1 : 1;
      if (a.classified && b.classified) return a.finishTime - b.finishTime;
      if (a.retired !== b.retired) return a.retired ? 1 : -1;
      return b.odo - a.odo;
    });

    const fl = this.fastestLap;
    const rows = order.map((v, i) => {
      const pos = i + 1;
      let points = RACE_POINTS[pos - 1] ?? 0;
      let fastestLap = false;
      if (fl && fl.vehicle === v) { points += FASTEST_LAP_POINT; fastestLap = true; }
      return {
        pos, driver: v.driver, team: v.team, isPlayer: v.isPlayer,
        driverId: v.driver.id, teamId: v.team.id,
        classified: v.classified, dnf: v.retired, dnfReason: v.retireReason,
        laps: Math.min(v.raceLaps, this.totalLaps),
        lapped: v.lapped || 0,
        time: v.finishTime, bestLap: v.bestLapTime,
        pitStops: v.pitStops,
        stints: v.stints.concat([{ compound: v.tire.compound, laps: v.tire.laps }]),
        tyreEnd: v.tire.wear,
        points, fastestLap,
        gridPos: v.gridSlot + 1,
        gained: v.gridSlot + 1 - pos,
        damage: v.damage,
      };
    });
    this.results = { rows, fastestLap: fl, laps: this.totalLaps, circuit: this.track.def };
    this.state = SESSION_STATE.FINISHED;
    return this.results;
  }

  /* ------------------------------------------------------------------ */
  /* Player helpers                                                      */
  /* ------------------------------------------------------------------ */

  requestPlayerPit(compound, fuel) {
    const p = this.player;
    if (!p || p.pit.requested) return false;
    return p.requestPit(compound || p.tire.compound, fuel);
  }

  cancelPlayerPit() {
    this.player?.cancelPit();
  }

  /** Distance to the pit entry, or null when not in the sequence. */
  pitEntryInfo() {
    const p = this.player;
    if (!p) return null;
    const track = this.track;
    const toEntry = track.delta(p.s, track.pit.entryS);
    const inWindow = track.inPitWindow(p.s);
    return {
      requested: p.pit.requested,
      stopped: p.pit.stopped,
      timer: p.pit.timer,
      duration: p.pit.duration,
      toEntry,
      inWindow,
      boxGap: Math.abs(track.signedDelta(track.pit.boxS, p.s)),
      speedLimit: track.pit.speedLimit,
      compound: p.pit.targetCompound || p.tire.compound,
    };
  }

  /** Mandatory-stop warning level: 0 fine, 1 warning, 2 urgent. */
  pitUrgency() {
    const p = this.player;
    if (!p) return 0;
    if (p.pitDone || p.pit.requested) return 0;
    if (p.tire.wear > 0.78 || p.fuel < 0.8) return 2;
    if (p.tire.wear > 0.55 || p.raceLaps >= 1) return 1;
    return 0;
  }

  suggestStrategy(preference = "balanced") {
    const p = this.player;
    if (!p) return [];
    const remaining = Math.max(2, this.totalLaps - p.raceLaps);
    return planStrategy(this.track, remaining, preference);
  }

  telemetry() {
    const p = this.player;
    return {
      state: this.state, flag: this.flag,
      lap: p ? Math.min(p.raceLaps + 1, this.totalLaps) : 1,
      totalLaps: this.totalLaps,
      position: p?.position ?? 1,
      cars: this.cars, player: p,
      raceTime: this.raceTime, leader: this.cars[0],
      fastestLap: this.fastestLap,
    };
  }
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}
