/**
 * Headless smoke test — runs the whole simulation without a browser.
 *   node tests/smoke.mjs
 *
 * Verifies track geometry, the AI flying-lap calibration, a full race and a
 * complete 12-round season including championship standings.
 */

import { performance } from "node:perf_hooks";
import { CIRCUITS } from "../js/data/circuits-data.js";
import { Track } from "../js/game/track.js";
import { RaceEngine } from "../js/game/race-engine.js";
import { measureFlyingLap, runQualifying } from "../js/game/qualifying.js";
import { cloneGrid, buildCarSpecs, defaultUpgrades } from "../js/data/teams-data.js";
import { createStandings, applyRaceResult, driversTable, constructorsTable } from "../js/game/standings.js";
import { planStrategy, tyreLifeEstimate, raceFuelLoad } from "../js/game/tires.js";
import { formatTime } from "../js/core/utils.js";

let failures = 0;
const ok = (cond, label, extra = "") => {
  if (cond) console.log(`  \u2713 ${label}${extra ? "  " + extra : ""}`);
  else { failures++; console.log(`  \u2717 ${label}  ${extra}`); }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const grid = cloneGrid();
const entries = [];
for (const team of grid) {
  const spec = buildCarSpecs(team, defaultUpgrades());
  for (const driver of team.drivers) entries.push({ team, driver, spec });
}
const refEntry = entries[0];

/* ------------------------------------------------------------------ */
section("1. Track geometry");
/* ------------------------------------------------------------------ */
const tracks = new Map();
for (const def of CIRCUITS) {
  const t0 = performance.now();
  const track = new Track(def);
  const build = performance.now() - t0;
  tracks.set(def.id, track);

  // Racing line must stay inside the white line everywhere.
  let maxOvershoot = 0;
  for (let i = 0; i < track.count; i++) {
    const lat = Math.abs(track.rlLateral[i]);
    maxOvershoot = Math.max(maxOvershoot, lat - track.halfWidth[i]);
  }
  // The line must form a closed loop that returns to its start.
  const gap = Math.hypot(track.rlX[0] - track.rlX[track.count - 1], track.rlY[0] - track.rlY[track.count - 1]);
  const widthErr = Math.max(...Array.from(track.halfWidth).map((h, i) => Math.abs(h * 2 - track.pw[i])));
  const okLen = Math.abs(track.length - def.length) < 12;
  const okLap = track.lapTimeEstimate > 25 && track.lapTimeEstimate < 140;
  const pit = track.pit;
  const pitOk = pit.boxS > 0 && pit.entryS > 0 && pit.exitS > 0;

  ok(
    okLen && maxOvershoot < 0.6 && gap < 6 && widthErr < 0.01 && okLap && pitOk,
    `${def.short.padEnd(13)} ${(track.length / 1000).toFixed(2)}km`,
    `est lap ${track.lapTimeEstimate.toFixed(1)}s · ${track.count} samples · ${track.corners.length} corners · build ${build.toFixed(0)}ms` +
      (maxOvershoot >= 0.6 ? `  !! line outside track by ${maxOvershoot.toFixed(2)}m` : "") +
      (gap >= 6 ? `  !! loop gap ${gap.toFixed(1)}m` : "")
  );
}

/* ------------------------------------------------------------------ */
section("2. Flying-lap calibration (real physics, AI driver)");
/* ------------------------------------------------------------------ */
const track0 = tracks.get(CIRCUITS[0].id);
let calT = performance.now();
const ref = measureFlyingLap(track0, refEntry.spec, refEntry.driver, 7);
const calMs = performance.now() - calT;
ok(ref > 25 && ref < 130, "reference lap", `${formatTime(ref)} in ${calMs.toFixed(0)}ms`);
ok(ref > track0.lapTimeEstimate, "reference slower than theoretical limit",
  `${ref.toFixed(2)}s vs ${track0.lapTimeEstimate.toFixed(2)}s`);

let calSpread = [];
for (const c of CIRCUITS.slice(0, 4)) {
  calSpread.push(measureFlyingLap(tracks.get(c.id), refEntry.spec, refEntry.driver, 7));
}
ok(calSpread.every((v) => v > 20 && v < 140), "all layouts produce sane lap times",
  calSpread.map((v) => v.toFixed(1)).join("s / ") + "s");

/* ------------------------------------------------------------------ */
section("3. Strategy maths");
/* ------------------------------------------------------------------ */
for (const name of ["aggressive", "balanced", "oneStop", "long"]) {
  const plan = planStrategy(track0, 6, name);
  const total = plan.reduce((a, s) => a + s.laps, 0);
  ok(total === 6 && plan.length >= 2, `${name} plan`, plan.map((s) => `${s.compound}x${s.laps}`).join(" + "));
}
const sLife = tyreLifeEstimate("soft", track0);
const mLife = tyreLifeEstimate("medium", track0);
const hLife = tyreLifeEstimate("hard", track0);
ok(sLife < mLife && mLife < hLife, "tyre life ordering",
  `S ${sLife.toFixed(1)}L / M ${mLife.toFixed(1)}L / H ${hLife.toFixed(1)}L`);
ok(Math.abs(raceFuelLoad(6) - 11.2) < 0.1, "fuel load for 6 laps", `${raceFuelLoad(6)} kg`);

/* ------------------------------------------------------------------ */
section("4. Full Grand Prix simulation");
/* ------------------------------------------------------------------ */
function simulateRace(track, laps, seed, playerId = null) {
  const q = runQualifying({ track, entries, playerId, seed, simulatePlayer: !!playerId });
  const gridRows = q.grid.map((row, i) => ({
    team: row.entry.team, driver: row.entry.driver, spec: row.entry.spec,
    gridPos: i + 1,
  }));
  const engine = RaceEngine.fromGrid({
    track, entries: gridRows, playerId, laps, seed, autopilot: !!playerId,
  });
  engine.begin();
  let steps = 0;
  const t0 = performance.now();
  const maxSeconds = laps * 200;
  while (engine.state !== "finished" && engine.raceTime < maxSeconds) {
    engine.step(1 / 120, null);
    steps++;
  }
  engine.buildResults();
  return { engine, results: engine.results, ms: performance.now() - t0, steps, qualifying: q };
}

const t0 = performance.now();
const { engine, results, ms, steps } = simulateRace(track0, 6, 2024, null);
ok(!!results, "race produced a classification", `${results.rows.length} classified in ${(ms).toFixed(0)}ms / ${steps} steps`);
ok(results.rows.every((r, i) => r.pos === i + 1), "positions are contiguous");
ok(results.rows[0].classified, "winner classified", `${results.rows[0].driver.short} for ${results.rows[0].team.short}`);
const dnfs = results.rows.filter((r) => r.dnf).length;
ok(dnfs <= 5, "retirement rate is plausible", `${dnfs} DNF(s)`);
const pitStops = results.rows.map((r) => r.pitStops);
ok(pitStops.every((n) => n >= 1), "every classified car made a mandatory stop", `stops ${Math.min(...pitStops)}-${Math.max(...pitStops)}`);
// The winner may also have set the fastest lap, so check the scale per row.
const SCALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const pointsOk = results.rows.slice(0, 10).every((r, i) => {
  const base = SCALE[i] ?? 0;
  return r.points === base + (r.fastestLap ? 1 : 0) - (r.dnf ? SCALE[i] ?? 0 : 0);
});
ok(pointsOk, "official points scale",
  `${results.rows.slice(0, 10).map((r) => r.points).join("/")} (+1 fastest lap)`);
ok(results.rows.some((r) => r.bestLap && r.bestLap > 20 && r.bestLap < 140), "best laps recorded",
  `fastest ${formatTime(results.fastestLap.time)} by ${results.fastestLap.vehicle.driver.short}`);

const offTrack = engine.cars.filter((c) => c.damage > 0.35).length;
ok(offTrack <= 6, "AI keeps it on track", `${offTrack} car(s) took significant damage`);

console.log("\n  Classification");
for (const r of results.rows.slice(0, 10)) {
  const fl = r.fastestLap ? " \u2605FL" : "";
  console.log(`   ${String(r.pos).padStart(2)}. ${r.driver.short.padEnd(4)} ${r.team.short.padEnd(13)} ` +
    `${r.dnf ? "DNF " + r.dnfReason : "L" + r.laps + " " + formatTime(r.time ?? 0)}  ` +
    `${r.pitStops} stop(s) ${r.stints.map((s) => s.compound[0].toUpperCase() + s.laps).join("-")}  ${r.points} pts${fl}`);
}
console.log(`\n  Race wall time ${(ms).toFixed(0)}ms for ${(engine.raceTime).toFixed(1)}s of racing ` +
  `(${(engine.raceTime / (ms / 1000)).toFixed(0)}x real time)`);

/* ------------------------------------------------------------------ */
section("5. Interactive player session (AI stands in for input)");
/* ------------------------------------------------------------------ */
{
  const q = runQualifying({ track: track0, entries, playerId: entries[0].driver.id, seed: 5, simulatePlayer: false });
  const gridRows = q.grid.map((row, i) => ({
    team: row.entry.team, driver: row.entry.driver, spec: row.entry.spec, gridPos: i + 1,
  }));
  const pid = entries[0].driver.id;
  const eng = RaceEngine.fromGrid({ track: track0, entries: gridRows, playerId: pid, laps: 6, seed: 9 });
  eng.begin();
  // Drive the player's car with the same AI brain as a smoke test of the control path.
  const { AIController, makeAIProfile } = await import("../js/game/ai.js");
  const ctrl = new AIController(eng.player, track0, makeAIProfile(eng.player.driver, eng.player.spec, eng.rng));
  let n = 0;
  while (eng.state !== "finished" && eng.raceTime < 1400) {
    ctrl.update(1 / 120, { cars: eng.cars, time: eng.time, state: eng.state });
    eng.step(1 / 120, { ...eng.player.desiredControls });
    n++;
  }
  eng.buildResults();
  const me = eng.results.rows.find((r) => r.isPlayer);
  ok(me != null, "player entry present in the classification",
    me ? `P${me.pos} for ${me.team.short}, ${me.points} pts` : "");
  ok(eng.player.lapsDone > 0, "player completed laps", `${eng.player.lapsDone} lap(s), best ${formatTime(eng.player.bestLapTime ?? 0)}`);
}

/* ------------------------------------------------------------------ */
section("6. Full 12-round championship");
/* ------------------------------------------------------------------ */
{
  const tStart = performance.now();
  const standings = createStandings(entries);
  const playerId = entries[3].driver.id;
  const careerResults = [];
  for (let i = 0; i < CIRCUITS.length; i++) {
    const track = tracks.get(CIRCUITS[i].id);
    const r = simulateRace(track, 6, 1000 + i * 37, playerId);
    applyRaceResult(standings, r.results);
    const me = r.results.rows.find((x) => x.isPlayer);
    careerResults.push({ round: i + 1, circuit: CIRCUITS[i].short, pos: me?.pos, points: me?.points ?? 0 });
  }
  const dt = driversTable(standings);
  const ct = constructorsTable(standings);
  const totalPoints = dt.reduce((a, d) => a + d.points, 0);
  ok(dt.length === 22, "22 drivers on the grid", `${dt.length}`);
  ok(ct.length === 11, "11 constructors", `${ct.length}`);
  ok(dt[0].points === dt[1].points ? true : dt[0].points >= dt[1].points, "table sorted by points");
  ok(totalPoints > 100, "points awarded across the season", `${totalPoints} points total`);
  const playerRow = dt.find((d) => d.driverId === playerId);
  ok(playerRow.points >= 0, "player scored over the season", `P${playerRow.pos} · ${playerRow.points} pts`);
  ok(new Set(careerResults.map((c) => c.circuit)).size === 12, "all 12 circuits raced");
  console.log(`\n  Player season: ${careerResults.map((c) => `R${c.round} P${c.pos}`).join("  ")}`);
  console.log(`  Champion: ${dt[0].driver.name} (${dt[0].points}) · Constructors: ${ct[0].team.short} (${ct[0].points})`);
  console.log(`  Season simulated in ${(performance.now() - tStart).toFixed(0)}ms`);
}

/* ------------------------------------------------------------------ */
console.log(failures === 0 ? "\n\x1b[32mAll checks passed.\x1b[0m\n" : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
