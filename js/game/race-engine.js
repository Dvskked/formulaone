/**
 * race-engine.js — the Grand Prix.
 *
 * Adds grid order, the standing start, mandatory pit stops, strategy for AI,
 * mechanical retirements, flags, the fastest lap, points and classification
 * on top of the shared session core.
 */

import { Session, SESSION_STATE } from "./session.js";
import { RACE_POINTS, FASTEST_LAP_POINT } from "../data/circuits-data.js";
import { COMPOUNDS, pitStopTime, raceFuelLoad, planStrategy, tyreLifeEstimate } from "./tires.js";

export const FLAG = { GREEN: "green", YELLOW: "yellow", CHEQUERED: "chequered" };

const PIT_BOX_RADIUS = 24;      // metres either side of the box
const CHEQUERED_GRACE = 22;     // seconds for backmarkers after the flag

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
  static fromGrid({ track, entries, playerId, laps, seed, assists }) {
    const engine = new RaceEngine({ track, entries, laps, seed, assists });
    const order = entries.slice().sort((a, b) => (a.gridPos ?? 99) - (b.gridPos ?? 99));
    order.forEach((e, i) => {
      engine.addEntry({
        team: e.team, driver: e.driver, spec: e.spec,
        isPlayer: e.driver.id === playerId,
        gridSlot: i,
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
      if (v.isPlayer) continue;
      const tm = v.driver.stats.tyres / 100;
      const aggr = v.driver.stats.aggression / 100;
      const pref = tm > 0.92 ? "oneStop" : aggr > 0.9 ? "aggressive" : "balanced";
      v.stintPlan = planStrategy(this.track, this.totalLaps, pref);
      v.stintCursor = 0;
      v.pitLapTarget = v.stintPlan[0].laps;
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
      this._pitLogic(v, dt);
      this._aiStrategy(v);
      this._mechanical(v, dt);
      this._flagLogic(v, dt);
    }
  }

  /* ---------------------------- pit stops ---------------------------- */

  _pitLogic(v, dt) {
    const track = this.track;
    const boxGap = Math.abs(track.signedDelta(track.pit.boxS, v.s));

    if (v.pit.stopped) {
      v.pit.timer -= dt;
      v.controls.brake = 1;
      v.controls.throttle = 0;
      if (v.pit.timer <= 0) {
        v.endPitStop();
        this.pushMessage(`${v.driver.short} rejoins on ${COMPOUNDS[v.tire.compound].short}`, "info", v);
      }
      return;
    }

    if (!v.pit.requested || v.retired || v.finished) return;

    if (boxGap < PIT_BOX_RADIUS && v.inPitLane && v.speed < 7) {
      const compound = v.pit.targetCompound || v.tire.compound;
      const t = pitStopTime(v.spec, v.team.stats, compound);
      const remaining = Math.max(2, this.totalLaps - v.lapsDone);
      const fuel = v.pit.refuelling != null ? v.pit.refuelling : raceFuelLoad(remaining) + 1.2;
      v.startPitStop(t.stationary, compound, Math.min(v.fuelCapacity, fuel));
      this.pushMessage(`${v.driver.short} pits — ${t.stationary.toFixed(1)}s stop`, "info", v);
      if (v.isPlayer) this.onPlayerPit?.(v, t);
      return;
    }
    // Overshot the box: cancel so the car can rejoin.
    if (boxGap > 110) {
      v.cancelPit();
      if (v.isPlayer) this.pushMessage("Pit entry missed — request cancelled", "bad", v);
    }
  }

  /** AI decide when to come in. */
  _aiStrategy(v) {
    if (v.retired || v.finished || v.pit.requested || v.pit.stopped) return;
    const lapsDone = v.lapsDone;
    const life = tyreLifeEstimate(v.tire.compound, this.track);
    const urgent = v.tire.wear > 0.84 || v.tire.laps >= life - 0.5;
    const maxStops = v.stintPlan.length;
    if (v.pitStops >= maxStops && !urgent) return;
    const scheduled = lapsDone >= (v.pitLapTarget ?? 99);
    if (!urgent && !scheduled) return;
    if (this.totalLaps - lapsDone <= 1 && !urgent) return;

    v.stintCursor = Math.min((v.stintCursor ?? 0) + 1, v.stintPlan.length - 1);
    const next = v.stintPlan[v.stintCursor];
    v.pitLapTarget = (v.pitLapTarget ?? 0) + (next?.laps ?? 3);

    const remaining = this.totalLaps - lapsDone;
    const compound = urgent && !next ? v.tire.compound : next.compound;
    v.requestPit(compound, Math.min(v.fuelCapacity, raceFuelLoad(remaining) + 1.2));
  }

  /* --------------------------- retirements ---------------------------- */

  _mechanical(v, dt) {
    if (v.retired || v.finished) return;
    const perSecond = (1 - v.spec.reliability) * 0.0042 + v.damage * 0.016;
    if (this.rng.next() < perSecond * dt) {
      this.retire(v, v.damage > 0.5 ? "Terminal damage" : "Mechanical failure");
    }
  }

  retire(v, reason) {
    if (v.retired) return;
    v.retired = true;
    v.retireReason = reason;
    v.vx = 0; v.vy = 0; v.speed = 0;
    this.pushMessage(`${v.driver.short} retires — ${reason}`, "bad", v);
    this.onRetire?.(v, reason);
  }

  /* ------------------------------ flags ------------------------------- */

  _flagLogic(v, dt) {
    if (v.retired || v.finished) return;
    if (v.speed < 1.6) {
      const t = (this._yellowCars.get(v.id) || 0) + dt;
      this._yellowCars.set(v.id, t);
      if (t > 1.4 && this.flag === FLAG.GREEN && !v.pit.stopped) {
        this.flag = FLAG.YELLOW;
        this.pushMessage("YELLOW FLAG — incident on track", "warn");
      }
    } else {
      this._yellowCars.delete(v.id);
    }
    if (this.flag === FLAG.YELLOW && this._yellowCars.size === 0) {
      this.flag = FLAG.GREEN;
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
    const leader = this.cars.reduce((a, b) => (b.lapsDone > a.lapsDone ? b : a), this.cars[0]);
    if (!this.chequered && leader.lapsDone >= this.totalLaps) {
      this.chequered = true;
      this.chequeredAt = this.raceTime;
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
      if (v.lapsDone >= this.totalLaps) {
        v.finishTime = this.raceTime;
        v.finished = true;
        v.classified = true;
        this.onFinish?.(v, v.finishTime);
      } else if (this.raceTime - this.chequeredAt > CHEQUERED_GRACE) {
        this.retire(v, "Lapped");
      }
    }
    if (this.cars.every((v) => v.finished || v.retired)) this.buildResults();
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
        laps: Math.min(v.lapsDone, this.totalLaps),
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
    if (p.tire.wear > 0.55 || p.lapsDone >= 1) return 1;
    return 0;
  }

  suggestStrategy(preference = "balanced") {
    const p = this.player;
    if (!p) return [];
    const remaining = Math.max(2, this.totalLaps - p.lapsDone);
    return planStrategy(this.track, remaining, preference);
  }

  telemetry() {
    const p = this.player;
    return {
      state: this.state, flag: this.flag,
      lap: p ? Math.min(p.lapsDone + 1, this.totalLaps) : 1,
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
