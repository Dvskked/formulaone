/**
 * qualifying.js — Saturday afternoon.
 *
 * Q1 and Q2 are simulated (so the grid is a full 22-car picture), then the
 * player goes out for the Q3 pole attack. Lap times for the rest of the
 * field are produced by a calibrated physics reference lap plus a
 * per-driver performance model, so the target is always achievable.
 */

import { Session, SESSION_STATE, FIXED_DT } from "./session.js";
import { makeRng } from "../core/rng.js";
import { AIController, makeAIProfile } from "./ai.js";
import { Vehicle, bindTrack } from "./vehicle.js";
import { clamp, clamp01 } from "../core/utils.js";
import { driverRating } from "../data/teams-data.js";
import { COMPOUNDS } from "./tires.js";

export const Q_SEGMENTS = [
  { key: "Q1", label: "Q1", eliminateFrom: 16 },
  { key: "Q2", label: "Q2", eliminateFrom: 11 },
  { key: "Q3", label: "Q3", eliminateFrom: 99 },
];

/* ------------------------------------------------------------------ */
/* Calibration — a real AI flying lap used as the reference pace       */
/* ------------------------------------------------------------------ */

const calibCache = new Map();

/** Run one AI car alone and return its best flying lap (seconds). */
export function measureFlyingLap(track, spec, driver, seed = 7) {
  const key = `${track.id}:${spec.topSpeed.toFixed(2)}:${spec.latAccel.toFixed(2)}`;
  if (calibCache.has(key)) return calibCache.get(key);

  const rng = makeRng(seed);
  const session = new Session({ track, entries: [], seed, type: "practice" });
  const v = session.addEntry({ team: { color: "#fff", accent: "#fff", stats: {} }, driver, spec, compound: "soft", fuel: 1.6 });
  bindTrack([v], track);
  v.placeAt(track, track.length - 60, 0);
  const ctrl = new AIController(v, track, makeAIProfile(driver, spec, rng));
  session.state = SESSION_STATE.GREEN;

  const maxSteps = Math.ceil(260 / FIXED_DT);
  for (let i = 0; i < maxSteps; i++) {
    ctrl.update(FIXED_DT, { cars: [v], time: session.time, state: "green" });
    v.stepPhysics(FIXED_DT, track, "asphalt");
    v.syncTrack(track);
    v.tire.wear = Math.min(v.tire.wear, 0.2);   // keep the calibration lap consistent
    session.time += FIXED_DT;
    if (v.lapsDone >= 3 && v.lastLapTime) break;
  }
  const best = v.bestLapTime || track.lapTimeEstimate * 1.18;
  calibCache.set(key, best);
  return best;
}

/* ------------------------------------------------------------------ */
/* Field simulation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Simulate a full qualifying session for the AI field.
 * @returns Map driverId -> { time, sectors, session }
 */
export function simulateField(track, entries, { seed = 1, refLap = null } = {}) {
  const rng = makeRng(seed ^ 0x9e37);
  const reference = refLap ?? measureFlyingLap(track, entries[0].spec, entries[0].driver, seed);
  const out = new Map();

  const times = entries.map((e) => {
    const rating = driverRating(e.driver);
    // 1.00 at an 88-rated driver; 0.985 at 99, 1.012 at 80.
    const paceAdj = 1 + (88 - rating) * 0.0016;
    const powerAdj = 1 - (e.spec.topSpeed - 90) * 0.00035;
    const base = reference * paceAdj * powerAdj;
    const cons = e.driver.stats.consistency / 100;
    // Three attempts; the best counts, as in a real qualifying session.
    const attempts = [0, 1, 2].map((i) => {
      const spread = (1.05 - cons) * 0.011;
      return base * (1 + rng.gauss() * spread + i * 0.004);
    });
    const best = Math.min(...attempts);
    const sectors = splitSectors(best, track, rng);
    return { entry: e, time: best, sectors, attempts };
  });

  // Segment structure: 5 out in Q1, 5 out in Q2, 10 through to Q3.
  const sorted = times.slice().sort((a, b) => a.time - b.time);
  const n = sorted.length;
  const q1Cut = Math.max(0, n - 5);
  const q2Cut = Math.max(0, n - 10);
  sorted.forEach((row, i) => {
    row.session = i < q2Cut ? "Q3" : i < q1Cut ? "Q2" : "Q1";
    row.gridPos = i + 1;
  });
  for (const row of times) out.set(row.entry.driver.id, row);
  return { results: out, reference };
}

function splitSectors(total, track, rng) {
  const b = track.sectorBias;
  return [
    total * b[0] * (1 + rng.gauss() * 0.006),
    total * b[1] * (1 + rng.gauss() * 0.006),
    total * b[2] * (1 + rng.gauss() * 0.006),
  ];
}

/**
 * Build the starting grid: the player's qualifying result is merged into the
 * simulated field.
 * @returns { rows, grid }
 */
export function buildGrid(track, entries, { seed = 1, playerId, playerTime, refLap } = {}) {
  const field = simulateField(track, entries.filter((e) => e.driver.id !== playerId), { seed, refLap });
  const rows = [];
  for (const [driverId, r] of field.results) {
    rows.push({
      driverId,
      entry: r.entry,
      time: r.time,
      sectors: r.sectors,
      session: r.session,
      isPlayer: false,
    });
  }
  if (playerId) {
    const playerEntry = entries.find((e) => e.driver.id === playerId);
    if (playerEntry) {
      if (playerTime != null) {
        const p = rows.filter((r) => r.time < playerTime).length;
        rows.push({
          driverId: playerId, entry: playerEntry, time: playerTime,
          sectors: splitSectors(playerTime, track, makeRng(seed + 1)),
          session: p < 10 ? "Q3" : p < 15 ? "Q2" : "Q1",
          isPlayer: true,
        });
      } else {
        // No time set: back of the grid.
        rows.push({
          driverId: playerId, entry: playerEntry, time: Infinity,
          sectors: [null, null, null], session: "—", isPlayer: true, noTime: true,
        });
      }
    }
  }
  rows.sort((a, b) => a.time - b.time);
  rows.forEach((r, i) => { r.gridPos = i + 1; });
  return { rows, reference: field.reference };
}

/* ------------------------------------------------------------------ */
/* Interactive qualifying session for the player                        */
/* ------------------------------------------------------------------ */

export class QualifyingSession extends Session {
  /**
   * @param {object} opts { track, entry, refLap, duration }
   */
  constructor(opts) {
    super({
      track: opts.track,
      entries: [],
      type: "qualifying",
      seed: opts.seed ?? 4242,
      assists: opts.assists,
    });
    this.duration = opts.duration ?? 240;
    this.refLap = opts.refLap;
    this.elapsed = 0;
    this.phase = "out";        // out | flying | done
    this.attempts = 0;
    this.bestLap = null;
    this.onTrackTime = 0;
    this.addEntry({
      team: opts.entry.team,
      driver: opts.entry.driver,
      spec: opts.entry.spec,
      isPlayer: true,
      compound: opts.compound || "soft",
      fuel: 1.6,
    });
    this.finalise();
    const startS = this.track.length - 55;
    this.player.placeAt(this.track, startS, -3);
    this.player.vx = Math.cos(this.player.heading) * 30;
    this.player.vy = Math.sin(this.player.heading) * 30;
    this.state = SESSION_STATE.GREEN;
    this.target = this.refLap ? this.refLap * 1.03 : null;
  }

  update(dt, playerInput) {
    if (this.paused || this.state === SESSION_STATE.FINISHED) return;
    super.update(dt, playerInput);
  }

  step(dt, playerInput) {
    if (this.paused || this.state === SESSION_STATE.FINISHED) return;
    const p = this.player;
    if (this.state === SESSION_STATE.GREEN) {
      this.elapsed += dt;
      this.onTrackTime += dt;
      if (this.phase === "out" && p.lapsDone >= 1) {
        this.phase = "flying";
        this.pushMessage("Out lap complete — this lap counts. Push!", "good", p);
      }
      if (this.elapsed >= this.duration) this.finishSession();
    }
    super.step(dt, playerInput);
  }

  onLapComplete(v, lap, lapTime) {
    if (!v.isPlayer) return;
    if (this.phase === "out") return;
    this.attempts++;
    const isBest = this.bestLap == null || lapTime < this.bestLap;
    if (isBest) {
      this.bestLap = lapTime;
      this.pushMessage(`New best: ${fmtTime(lapTime)}`, "good", v);
    } else {
      this.pushMessage(`Lap ${lapTime.toFixed(3)}s — best is ${this.bestLap.toFixed(3)}s`, "info", v);
    }
  }

  finishSession() {
    this.state = SESSION_STATE.FINISHED;
    this.phase = "done";
  }

  /** Park the car early — the player does not have to use the whole window. */
  requestEnd() {
    if (this.state === SESSION_STATE.FINISHED) return;
    this.pushMessage("Session over — returning to the paddock", "info", this.player);
    this.finishSession();
  }

  result() {
    return {
      time: this.bestLap,
      attempts: this.attempts,
      sectors: this.player.bestSectors,
      used: this.elapsed,
      target: this.target,
    };
  }
}

/**
 * Full qualifying flow used by the career/quick-race screens.
 * @returns { grid, playerResult, segmentLog }
 */
export function runQualifying({ track, entries, playerId, seed, simulatePlayer = true, refLap }) {
  const reference = refLap ?? measureFlyingLap(track, entries[0].spec, entries[0].driver, seed ?? 11);
  let playerTime = null;
  let playerResult = null;
  if (simulatePlayer && playerId) {
    const entry = entries.find((e) => e.driver.id === playerId);
    if (entry) {
      const rng = makeRng((seed ?? 11) + 77);
      const rating = driverRating(entry.driver);
      playerTime = reference * (1 + (88 - rating) * 0.0016) * (1 + rng.gauss() * 0.006);
      playerResult = { time: playerTime, simulated: true };
    }
  }
  const grid = buildGrid(track, entries, { seed: seed ?? 1, playerId, playerTime, refLap: reference });
  return { grid: grid.rows, reference, playerResult };
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}
